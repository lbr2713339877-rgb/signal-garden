import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Database, DbHandle } from "@/db/client";
import { signalDate } from "@/lib/day";
import { scoreDaily } from "@/scoring/daily";
import { notPreviouslyFeatured } from "@/scoring/exposure";
import { getArchiveEditions, getFeatures, getHeadline, getTodaysSignals } from "@/db/queries";
import { publish } from "./publish";
import { DISCOVERY_REVIEW_VERSION, refreshedDiscoveryDocuments, currentDiscoveryReview } from '@/normalizers/discovery-policy';
import { getInterestingDiscoveries, getByTaxonomy, getTaxonomyCounts } from '@/db/queries';

test("daily discovery publication and history", async (t) => {
  const raw = new PGlite();
  const d = drizzle(raw, { schema });
  for (const file of readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort()) {
    await raw.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
  const store = globalThis as typeof globalThis & { __sgDb?: DbHandle | null };
  const previousHandle = store.__sgDb;
  store.__sgDb = { db: d as unknown as Database, driver: "pglite", raw, close: () => raw.close() };
  const today = signalDate();
  const ago = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  const reset = () => raw.exec("TRUNCATE project CASCADE");
  async function project(name: string, over: Partial<typeof schema.project.$inferInsert> = {}) {
    const [p] = await d.insert(schema.project).values({
      canonicalProjectId: `repo:${name}`, slug: name, name, primaryUrl: `https://github.com/test/${name}`,
      stars: 500, focusScore: 5, parseState: "parsed", linkStatus: "ok", category: "devtool",
      primaryCategory: "dev-tools", docSignals: { hasReadme: true, hasInstallSection: true },
      riskFlags: [], parsedAt: new Date(), contributors: 3, ...over,
    }).returning();
    await d.insert(schema.aiContent).values({ projectId: p.id, locale: "zh", passedGuard: true,
      oneLiner: name, hook: `${name} hook`, capabilities: ["生成页面", "查看结果", "修改内容"] });
    return p;
  }
  async function signal(id: string, date = today, published = false, heat = 50) {
    await d.insert(schema.dailySignal).values({ projectId: id, signalDate: date, rank: 1,
      heatScore: heat, breakdown: {}, isPublished: published });
  }

  try {
    await t.test('repository parsing preserves proof for unchanged README text and blocks changed sources', async () => {
      await reset();
      const review = {version: DISCOVERY_REVIEW_VERSION,hash:'readme-v1',passed:true,interesting:true,reviewedAt:new Date().toISOString()};
      const p = await project('chat-bot', {readmeHash:'readme-v1',focusThemes:['play'],docSignals:{hasReadme:true,hasInstallSection:true,discoveryReview:review}});
      await d.update(schema.project).set({docSignals:refreshedDiscoveryDocuments({hasReadme:true,hasExamples:true})}).where(eq(schema.project.id,p.id));
      const [same] = await d.select().from(schema.project).where(eq(schema.project.id,p.id));
      assert.equal(currentDiscoveryReview(same.docSignals,same.readmeHash)?.passed,true);
      assert.equal((same.docSignals as any).hasInstallSection,undefined, 'only review proof survives; document facts are refreshed');
      await d.update(schema.project).set({readmeHash:'readme-v2',docSignals:refreshedDiscoveryDocuments({hasReadme:true})}).where(eq(schema.project.id,p.id));
      const [changed] = await d.select().from(schema.project).where(eq(schema.project.id,p.id));
      assert.equal(currentDiscoveryReview(changed.docSignals,changed.readmeHash),null);
      await signal(p.id);
      assert.equal((await publish()).itemsOut,0);
    });
    await t.test('category pages paginate tied scores without repeating projects', async () => {
      await reset();
      for (const name of ['page-a', 'page-b', 'page-c']) await project(name, { secondaryCategory: 'cli' });
      const pages = [];
      for (let offset = 0; offset < 3; offset++) pages.push(...await getByTaxonomy('dev-tools', { secondary: 'cli', limit: 1, offset }));
      assert.equal(new Set(pages.map(p => p.id)).size, 3);
      assert.equal((await getByTaxonomy('dev-tools', { secondary: 'cli', limit: 1, offset: 3 })).length, 0);
    });
    await t.test('reviewed websites need no GitHub stars, remain discoverable, and stale reviews block publishing', async () => {
      await reset();
      const p = await project('video-editor', { projectKind: 'product', stars: 0, category: 'media', primaryCategory: 'ai-tools',
        secondaryCategory: 'image-video', focusThemes: ['play'], readmeHash: 'source-v1',
        parseEvidence: { website: { url: 'https://editor.example.com' } },
        securityLevel: 'unknown', docSignals: { hasReadme: true, hasOfficialPage: true,
          discoveryReview: { version: DISCOVERY_REVIEW_VERSION, hash: 'source-v1', passed: true, interesting: true, reason: 'documented use' } } });
      await scoreDaily({ limit: 30, top: 20 });
      assert.equal((await publish()).itemsOut, 1);
      assert.equal((await getInterestingDiscoveries())[0].id, p.id);
      assert.equal((await getByTaxonomy('ai-tools', { interesting: true }))[0].id, p.id);
      assert.equal((await getTaxonomyCounts('ai-tools'))[0].n, 1);
      await d.update(schema.aiContent).set({ passedGuard: false }).where(eq(schema.aiContent.projectId, p.id));
      assert.deepEqual(await getInterestingDiscoveries(), [], 'a new review cannot surface copy that needs regeneration');
      await d.update(schema.aiContent).set({ passedGuard: true }).where(eq(schema.aiContent.projectId, p.id));
      await d.update(schema.project).set({ readmeHash: 'source-v2' }).where(eq(schema.project.id, p.id));
      assert.deepEqual(await getInterestingDiscoveries(), []);
      assert.equal((await publish()).itemsOut, 0);
    });
    await t.test("excludes every past edition, including 2, 3 and 30 days ago, without filling from history", async () => {
      await reset();
      for (const days of [1, 2, 3, 30]) {
        const p = await project(`old-${days}`);
        await signal(p.id, ago(days), true, 90);
        await signal(p.id, today, false, 90);
      }
      const fresh = await project("fresh");
      await signal(fresh.id);
      assert.equal((await publish({ top: 15 })).itemsOut, 1);
      assert.deepEqual((await getTodaysSignals()).cards.map((p) => p.id), [fresh.id]);
      assert.equal((await publish({ top: 15 })).itemsOut, 1, "same-day reruns stay eligible");
    });

    await t.test("repo aliases and a website sharing its official domain count as prior exposure", async () => {
      await reset();
      const old = await project("old", { domain: "Example.COM", githubNodeId: "stable-node" });
      await signal(old.id, ago(3), true);
      const aliases = [
        await project("website", { projectKind: "product", primaryUrl: "https://www.example.com/docs" }),
        await project("renamed", { githubNodeId: "stable-node" }),
        await project("alias", { primaryUrl: "https://GitHub.com/test/old.git#readme" }),
        await project("homepage", { homepageUrl: "https://www.example.com/" }),
      ];
      for (const p of aliases) await signal(p.id);
      assert.equal((await publish()).itemsOut, 0);
      assert.equal((await getHeadline()), null, "an empty edition must not resurrect an old headline");
      assert.deepEqual(await getFeatures(), []);
    });

    await t.test("unpublished candidates and future editions do not consume novelty", async () => {
      await reset();
      const p = await project("candidate");
      await signal(p.id, ago(3), false);
      await signal(p.id, ago(-1), true);
      const rows = await d.select().from(schema.project).where(notPreviouslyFeatured(today));
      assert.equal(rows.length, 1);
      assert.deepEqual((await getTodaysSignals()).cards, [], "never substitute the catalogue or another date");
      assert.deepEqual(await getArchiveEditions(), []);
    });

    await t.test("one official website occupies at most one slot per edition", async () => {
      await reset();
      const a = await project("one", { domain: "example.com" });
      const b = await project("two", { homepageUrl: "https://www.example.com" });
      const c = await project("other", { domain: "other.example.com" });
      for (const p of [a, b, c]) await signal(p.id);
      assert.equal((await publish()).itemsOut, 2);
    });

    await t.test("a shared social profile host does not identify unrelated projects", async () => {
      await reset();
      const a = await project("social-one", { domain: "linkedin.com" });
      const b = await project("social-two", { homepageUrl: "https://www.linkedin.com/in/other" });
      await signal(a.id, ago(3), true);
      await signal(b.id);
      assert.equal((await publish()).itemsOut, 1);
    });

    await t.test("a failed publication rolls back the full edition", async () => {
      await reset();
      const a = await project("existing");
      await signal(a.id, today, true);
      await raw.exec(`CREATE FUNCTION reject_publication() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.is_published THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_publication BEFORE UPDATE ON daily_signal FOR EACH ROW EXECUTE FUNCTION reject_publication()`);
      try {
        await assert.rejects(publish());
        assert.equal((await getHeadline())?.id, a.id, "reset must roll back with the failed update");
      } finally {
        await raw.exec("DROP TRIGGER reject_publication ON daily_signal; DROP FUNCTION reject_publication()");
      }
    });

    await t.test("scoring keeps candidates private and preserves a published edition on rerun", async () => {
      await reset();
      const old = await project("previous", { heatScoreLatest: 100 });
      await signal(old.id, ago(2), true, 90);
      const fresh = await project("new");
      await scoreDaily({ limit: 20, top: 20 });
      assert.deepEqual((await getTodaysSignals()).cards, []);
      assert.equal((await d.select().from(schema.dailySignal).where(eq(schema.dailySignal.signalDate, today))).length, 1);
      assert.equal((await publish()).itemsOut, 1);
      assert.equal((await getHeadline())?.id, fresh.id);
      await scoreDaily({ limit: 20, top: 20 });
      assert.equal((await getHeadline())?.id, fresh.id);
      const archive = await getArchiveEditions();
      assert.equal(archive[0].date, ago(2));
      assert.equal(archive[0].cards[0].id, old.id);
      assert.equal(archive[0].cards[0].heatScore, 90, "archive uses the saved score");
    });
  } finally {
    store.__sgDb = previousHandle;
    await raw.close();
  }
});
