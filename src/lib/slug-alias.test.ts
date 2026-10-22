import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Database, DbHandle } from "@/db/client";
import { signalDate } from "@/lib/day";
import { siteOrigin } from "@/lib/edition";
import { readmeBadgeMarkdown } from "@/lib/badge";
import { pingRenamedProjectSlugs } from "@/lib/indexnow";
import { allocateSlug, badgeAliasPath, ensureCurrentSlug, loadReservedSlugs, resolveSlug } from "@/lib/slug-alias";
import { redirectAlias } from "@/lib/slug-redirect";
import { aliasLookupUrl, aliasRedirectPath } from "@/lib/slug-redirect-path";
import { backfillSlugs } from "@/jobs/slugs";
import { createFeedback } from "@/db/queries";
import { GET as badgeGet } from "@/app/badge/[owner]/[repo]/route";
import { GET as todayGet } from "@/app/api/today.json/route";

test("alias paths cover project, classic and feedback pages", () => {
  assert.deepEqual(aliasRedirectPath("/p/cosscom-coss"), { slug: "cosscom-coss", prefix: "/p", suffix: "" });
  assert.deepEqual(aliasRedirectPath("/p/trailhq-graft/classic"), { slug: "trailhq-graft", prefix: "/p", suffix: "/classic" });
  assert.deepEqual(aliasRedirectPath("/feedback/old-slug"), { slug: "old-slug", prefix: "/feedback", suffix: "" });
  assert.equal(aliasRedirectPath("/p/cosscom-coss/opengraph-image"), null);
  assert.equal(aliasRedirectPath("/p/cosscom-coss/twitter-image"), null);
  assert.equal(aliasRedirectPath("/badge/cosscom/coss.svg"), null);
  assert.equal(
    aliasLookupUrl("cosscom-coss").href,
    "http://127.0.0.1:3000/api/slug-alias?slug=cosscom-coss",
  );
});

test("alias redirects are permanent and keep the query string", () => {
  assert.throws(
    () => redirectAlias("/p", "cosscom-ui", { utm_source: "badge" }),
    (error: unknown) => {
      const digest = (error as { digest?: string }).digest ?? "";
      assert.equal(digest, "NEXT_REDIRECT;replace;/p/cosscom-ui?utm_source=badge;308;");
      return true;
    },
  );
  assert.throws(
    () => redirectAlias("/p", "trailhq-trail-code", { ref: ["a", "b"] }, "/classic"),
    (error: unknown) => {
      const digest = (error as { digest?: string }).digest ?? "";
      assert.equal(digest, "NEXT_REDIRECT;replace;/p/trailhq-trail-code/classic?ref=a&ref=b;308;");
      return true;
    },
  );
});

test("renamed slugs redirect, occupied slugs stay, and public surfaces use the current slug", async () => {
  const raw = new PGlite();
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
    await raw.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
  const d = drizzle(raw, { schema });
  const store = globalThis as typeof globalThis & { __sgDb?: DbHandle | null };
  const previous = store.__sgDb;
  store.__sgDb = { db: d as unknown as Database, driver: "pglite", raw, close: () => raw.close() };
  const previousKey = process.env.INDEXNOW_KEY;
  delete process.env.INDEXNOW_KEY;
  const today = signalDate();

  async function project(input: { slug: string; fullName: string; canonical: string; published?: boolean }) {
    const [row] = await d.insert(schema.project).values({
      canonicalProjectId: input.canonical,
      slug: input.slug,
      name: input.slug,
      owner: input.fullName.split("/")[0],
      fullName: input.fullName,
      primaryUrl: `https://github.com/${input.fullName}`,
      description: "Vendor text",
      parseState: "parsed",
      stars: 400,
      stars24h: 11,
      stars7d: 30,
      forks7d: 4,
    }).returning();
    if (input.published) {
      await d.insert(schema.dailySignal).values({
        projectId: row.id,
        signalDate: today,
        rank: 1,
        heatScore: 72.5,
        breakdown: {},
        isPublished: true,
      });
      await d.insert(schema.aiContent).values([
        { projectId: row.id, locale: "zh", oneLiner: "中文一句。", passedGuard: true },
        { projectId: row.id, locale: "en", oneLiner: "An English line.", passedGuard: true },
      ]);
    }
    return row;
  }

  try {
    const ui = await project({
      slug: "cosscom-coss",
      fullName: "cosscom/ui",
      canonical: "gh:old-coss",
      published: true,
    });
    const moved = await d.transaction((tx) => ensureCurrentSlug(tx, {
      id: ui.id,
      slug: ui.slug,
      fullName: "cosscom/ui",
    }));
    assert.equal(moved.changed, true);
    assert.equal(moved.slug, "cosscom-ui");
    const [alias] = await d.select().from(schema.projectSlugAlias).where(eq(schema.projectSlugAlias.slug, "cosscom-coss"));
    assert.equal(alias.projectId, ui.id);
    const resolved = await resolveSlug("cosscom-coss");
    assert.equal(resolved?.id, ui.id);
    assert.equal(resolved?.slug, "cosscom-ui");
    assert.equal(resolved?.redirectTo, "cosscom-ui");
    assert.equal((await resolveSlug("cosscom-ui"))?.redirectTo, null);

    const holder = await project({
      slug: "trailhq-trail-code",
      fullName: "someone/else",
      canonical: "gh:holder",
    });
    const blocked = await project({
      slug: "trailhq-graft",
      fullName: "trailhq/Trail-Code",
      canonical: "gh:graft",
    });
    const kept = await d.transaction((tx) => ensureCurrentSlug(tx, blocked));
    assert.deepEqual(kept, { slug: "trailhq-graft", changed: false });
    assert.equal((await d.select().from(schema.projectSlugAlias).where(eq(schema.projectSlugAlias.slug, "trailhq-graft"))).length, 0);
    assert.equal((await d.select().from(schema.project).where(eq(schema.project.id, holder.id)))[0]?.slug, "trailhq-trail-code");

    const reservedByAlias = await project({
      slug: "old-kit",
      fullName: "nateherkai/herk-edit-kit",
      canonical: "gh:kit-holder",
    });
    await d.insert(schema.projectSlugAlias).values({ slug: "nateherkai-herk-edit-kit", projectId: holder.id });
    const aliasBlocked = await d.transaction((tx) => ensureCurrentSlug(tx, reservedByAlias));
    assert.equal(aliasBlocked.changed, false);
    assert.equal(aliasBlocked.slug, "old-kit");

    const reserved = await loadReservedSlugs(d);
    assert.equal(allocateSlug("cosscom-coss", reserved), "cosscom-coss-2");
    assert.equal(allocateSlug("fresh-repo", reserved), "fresh-repo");

    const response = await todayGet();
    const body = await response.json() as { items: Array<{ name: string; project_url: string }> };
    const item = body.items.find((row) => row.name === "cosscom-coss");
    assert.ok(item);
    assert.equal(item.project_url, `${siteOrigin()}/p/cosscom-ui`);
    assert.equal(item.project_url.includes("cosscom-coss"), false);

    const markdown = readmeBadgeMarkdown({ owner: "cosscom", repo: "ui", slug: "cosscom-ui" });
    assert.match(markdown, /\/p\/cosscom-ui\?/);
    assert.equal(markdown.includes("cosscom-coss"), false);
    assert.match(markdown, /\/badge\/cosscom\/ui\.svg/);

    const feedback = await createFeedback({ slug: "cosscom-coss", kind: "dead_link", note: "old link" });
    assert.ok(feedback);
    const [stored] = await d.select().from(schema.userFeedback).where(eq(schema.userFeedback.id, feedback.id));
    assert.equal(stored.projectId, ui.id);

    await d.update(schema.project).set({ fullName: "old/kit" }).where(eq(schema.project.id, reservedByAlias.id));
    await d.delete(schema.project).where(eq(schema.project.id, holder.id));
    await d.update(schema.project).set({ slug: "trailhq-trail-code", fullName: "trailhq/Trail-Code" }).where(eq(schema.project.id, blocked.id));
    await d.insert(schema.projectSlugAlias).values({ slug: "trailhq-graft", projectId: blocked.id });
    await d.insert(schema.dailySignal).values({
      projectId: blocked.id,
      signalDate: today,
      rank: 2,
      heatScore: 10,
      breakdown: {},
      isPublished: true,
    });
    assert.equal(await badgeAliasPath("trailhq", "graft"), "/badge/trailhq/Trail-Code.svg");
    const redirected = await badgeGet(new Request("https://signalgarden.site/badge/trailhq/graft.svg?theme=dark"), {
      params: Promise.resolve({ owner: "trailhq", repo: "graft.svg" }),
    });
    assert.equal(redirected.status, 308);
    assert.equal(redirected.headers.get("location"), "/badge/trailhq/Trail-Code.svg?theme=dark");

    const fresh = await project({
      slug: "cosscom-coss-2",
      fullName: "cosscom/coss",
      canonical: "gh:1413371536",
    });
    assert.equal(await badgeAliasPath("cosscom", "coss"), null);
    const miss = await badgeGet(new Request("https://signalgarden.site/badge/cosscom/coss.svg"), {
      params: Promise.resolve({ owner: "cosscom", repo: "coss.svg" }),
    });
    assert.equal(miss.status, 404);
    assert.equal(fresh.slug, "cosscom-coss-2");

    const calls: { body: { urlList: string[] } }[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      calls.push({ body: JSON.parse(String(init?.body)) });
      return new Response("accepted", { status: 202 });
    };
    await pingRenamedProjectSlugs(["cosscom-ui"], {
      key: "a".repeat(32),
      origin: "https://signalgarden.site",
      fetchImpl,
    });
    assert.deepEqual(calls[0]?.body.urlList, ["https://signalgarden.site/p/cosscom-ui"]);
    await pingRenamedProjectSlugs(["cosscom-ui"], { key: "", fetchImpl });
    assert.equal(calls.length, 1);

    const pending = await project({
      slug: "nateherkai-hyperframes-student-kit",
      fullName: "nateherkai/herk-edit-kit",
      canonical: "gh:herk",
    });
    await d.delete(schema.projectSlugAlias).where(eq(schema.projectSlugAlias.slug, "nateherkai-herk-edit-kit"));
    const preview = await backfillSlugs({ dryRun: true });
    assert.equal((await d.select().from(schema.project).where(eq(schema.project.id, pending.id)))[0]?.slug, pending.slug);
    assert.equal(preview.meta?.dryRun, true);
    const applied = await backfillSlugs();
    assert.equal(applied.itemsOut >= 1, true);
    assert.equal((await resolveSlug("nateherkai-hyperframes-student-kit"))?.redirectTo, "nateherkai-herk-edit-kit");
    assert.equal((await d.select().from(schema.project).where(eq(schema.project.id, pending.id)))[0]?.slug, "nateherkai-herk-edit-kit");
  } finally {
    if (previousKey === undefined) delete process.env.INDEXNOW_KEY;
    else process.env.INDEXNOW_KEY = previousKey;
    store.__sgDb = previous;
    await raw.close();
  }
});

test("pages redirect aliases only after a miss, and the open graph image does not", () => {
  const page = readFileSync("src/app/p/[slug]/page.tsx", "utf8");
  const classic = readFileSync("src/app/p/[slug]/classic/page.tsx", "utf8");
  const feedback = readFileSync("src/app/feedback/[slug]/page.tsx", "utf8");
  const image = readFileSync("src/app/p/[slug]/opengraph-image.tsx", "utf8");
  const discover = readFileSync("src/jobs/discover.ts", "utf8");
  const cli = readFileSync("src/jobs/cli.ts", "utf8");
  const middleware = readFileSync("src/middleware.ts", "utf8");
  assert.equal(middleware.includes("aliasLookupUrl"), false);
  assert.equal(middleware.includes("slug-alias"), false);
  assert.equal(middleware.includes("NextResponse.redirect"), false);
  assert.equal(middleware.includes("nextUrl.clone"), false);
  // A root loading boundary turns page redirects into HTTP 200. /p and /feedback stay outside it.
  assert.equal(existsSync("src/app/loading.tsx"), false);
  assert.equal(existsSync("src/app/(site)/loading.tsx"), true);
  assert.equal(existsSync("src/app/(site)/p"), false);
  assert.equal(existsSync("src/app/(site)/feedback"), false);
  assert.match(page, /revalidate = 3600/);
  assert.match(page, /dynamicParams = true/);
  assert.match(page, /generateStaticParams/);
  for (const source of [page, classic, feedback]) {
    const body = source.slice(source.indexOf("export default async function"));
    const lookup = body.indexOf("getProjectBySlug(slug)");
    const redirect = body.indexOf("redirectIfAlias(");
    const missing = body.lastIndexOf("notFound()");
    assert.ok(lookup !== -1 && redirect !== -1 && missing !== -1);
    assert.ok(lookup < redirect && redirect < missing);
    assert.equal(body.includes("cookies("), false);
    assert.equal(body.includes("headers("), false);
  }
  // ISR cannot read searchParams (production 500). Dynamic pages still do, and only after a miss.
  assert.equal(page.slice(page.indexOf("export default async function")).includes("await searchParams"), false);
  assert.match(page, /redirectIfAlias\(\s*"\/p",\s*slug,\s*\{\}\s*\)/);
  for (const source of [classic, feedback]) {
    const body = source.slice(source.indexOf("export default async function"));
    const search = body.indexOf("await searchParams");
    assert.ok(search > body.indexOf("if (!data)"));
  }
  assert.match(page, /redirectIfAlias\(\s*"\/p"/);
  assert.match(classic, /redirectIfAlias\(\s*"\/p"/);
  assert.match(classic, /"\/classic"/);
  assert.match(feedback, /redirectIfAlias\(\s*"\/feedback"/);
  assert.match(image, /canonicalProjectSlug/);
  assert.equal(image.includes("permanentRedirect"), false);
  assert.match(discover, /projectSlugAlias/);
  assert.match(discover, /allocateSlug/);
  assert.match(discover, /ensureCurrentSlug/);
  const steps = cli.slice(cli.indexOf("const DAILY_STEPS"), cli.indexOf("] as const"));
  assert.equal(steps.includes("slugs"), false);
  const daily = cli.slice(cli.indexOf("daily:"));
  assert.ok(daily.indexOf("submitIndexNow") !== -1);
  assert.ok(daily.indexOf("submitIndexNow") < daily.indexOf("revalidatePublishedProjectPages"));
});
