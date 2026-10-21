import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import React from "react";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import type { Database, DbHandle } from "@/db/client";
import ProjectPage from "@/app/p/[slug]/page";
import { ProjectActions } from "@/components/v3/ProjectActions";

const SECRET = "secret-user@example.com";

function walk(node: unknown, visit: (el: { type: unknown; props: Record<string, unknown> }) => void) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  const el = node as { props?: Record<string, unknown> };
  if (!el.props) return;
  visit(el as { type: unknown; props: Record<string, unknown> });
  walk(el.props.children, visit);
}

function textOf(node: unknown, out: string[]) {
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return;
  }
  walk(node, (el) => textOf(el.props.children, out));
}

test("cached project HTML has no session, and alias misses are permanent redirects", async () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const shell = readFileSync("src/components/v3/V3Shell.tsx", "utf8");
  const menu = readFileSync("src/components/v3/UserMenu.tsx", "utf8");
  const nav = readFileSync("src/components/v3/V3Nav.tsx", "utf8");
  const actions = readFileSync("src/components/v3/ProjectActions.tsx", "utf8");
  const page = readFileSync("src/app/p/[slug]/page.tsx", "utf8");
  for (const source of [layout, shell, page]) {
    assert.doesNotMatch(source, /cookies\(|headers\(|draftMode\(|getCurrentUser/);
  }
  assert.match(menu, /'use client'/);
  assert.match(menu, /useState<any>\(null\)/);
  assert.match(menu, /supabase\.auth\.getUser\(\)/);
  assert.match(actions, /'use client'/);
  assert.match(actions, /useSaved\(\)/);
  assert.doesNotMatch(page, /<ProjectActions[^>]*\buser=/);
  assert.match(page, /<ProjectActions slug=\{p\.slug\} \/>/);
  assert.match(nav, /<UserMenu \/>/);
  assert.doesNotMatch(nav, /<UserMenu[^>]*\buser=/);

  const raw = new PGlite();
  for (const file of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) {
    await raw.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
  const d = drizzle(raw, { schema });
  const store = globalThis as typeof globalThis & { __sgDb?: DbHandle | null };
  const previous = store.__sgDb;
  store.__sgDb = { db: d as unknown as Database, driver: "pglite", raw, close: () => raw.close() };

  async function project(slug: string, fullName: string, alias?: string) {
    const [row] = await d.insert(schema.project).values({
      canonicalProjectId: `gh:${slug}`,
      slug,
      name: slug === "cosscom-ui" ? "Coss UI" : slug,
      owner: fullName.split("/")[0],
      fullName,
      primaryUrl: `https://github.com/${fullName}`,
      description: "Vendor text",
      parseState: "parsed",
    }).returning();
    if (alias) await d.insert(schema.projectSlugAlias).values({ slug: alias, projectId: row.id });
    return row;
  }

  try {
    await project("cosscom-ui", "cosscom/ui", "cosscom-coss");
    await project("trailhq-trail-code", "trailhq/Trail-Code", "trailhq-graft");
    await project("nateherkai-herk-edit-kit", "nateherkai/herk-edit-kit", "nateherkai-hyperframes-student-kit");

    const cases = [
      ["cosscom-coss", "/p/cosscom-ui"],
      ["trailhq-graft", "/p/trailhq-trail-code"],
      ["nateherkai-hyperframes-student-kit", "/p/nateherkai-herk-edit-kit"],
    ] as const;
    for (const [slug, location] of cases) {
      await assert.rejects(
        () => ProjectPage({
          params: Promise.resolve({ slug }),
        }),
        (error: unknown) => {
          assert.equal((error as { digest?: string }).digest, `NEXT_REDIRECT;replace;${location};308;`);
          return true;
        },
      );
    }

    await assert.rejects(
      () => ProjectPage({
        params: Promise.resolve({ slug: "missing-project" }),
      }),
      (error: unknown) => {
        assert.equal((error as { digest?: string }).digest, "NEXT_HTTP_ERROR_FALLBACK;404");
        return true;
      },
    );

    // tsx compiles this page's JSX with the classic runtime. The page must not
    // read a searchParams promise: production ISR turns that into a 500, and
    // the cached HTML would be allowed to vary by request.
    (globalThis as typeof globalThis & { React?: typeof React }).React = React;
    let touched = false;
    const searchParams = {
      then(onFulfilled: (value: unknown) => unknown) {
        touched = true;
        return Promise.resolve({ utm_source: SECRET, cookie: "sb-ref-auth-token=session" }).then(onFulfilled);
      },
    };
    const element = await ProjectPage({
      params: Promise.resolve({ slug: "cosscom-ui" }),
      searchParams: searchParams as Promise<Record<string, string>>,
    } as Parameters<typeof ProjectPage>[0]);
    assert.equal(touched, false);
    const texts: string[] = [];
    const actionProps: Record<string, unknown>[] = [];
    walk(element, (el) => {
      textOf(el.props.children, texts);
      if (el.type === ProjectActions) actionProps.push(el.props);
    });
    const html = texts.join("\n");
    assert.match(html, /Coss UI/);
    assert.equal(html.includes(SECRET), false);
    assert.equal(html.includes("sb-ref-auth-token"), false);
    assert.equal(html.includes("My Garden"), false);
    assert.equal(actionProps.length, 1);
    assert.equal(actionProps[0]?.slug, "cosscom-ui");
    assert.equal("user" in (actionProps[0] ?? {}), false);
  } finally {
    store.__sgDb = previous;
    await raw.close();
  }
});
