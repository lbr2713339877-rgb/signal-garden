import assert from "node:assert/strict";
import { test } from "node:test";
import {
  githubCodeRepository,
  jsonLdHtml,
  projectJsonLd,
  siteJsonLd,
  todayItemList,
} from "./jsonld";

const ORIGIN = "https://signalgarden.site";

test("site graph is WebSite + Organization, with SearchAction only when search exists", () => {
  const withSearch = siteJsonLd({ origin: ORIGIN, search: true });
  const graph = withSearch["@graph"] as Record<string, unknown>[];
  assert.equal(graph[0]["@type"], "WebSite");
  assert.equal(graph[0].name, "Signal Garden");
  assert.equal(graph[0].url, ORIGIN);
  const action = graph[0].potentialAction as Record<string, unknown>;
  assert.equal(action["@type"], "SearchAction");
  const target = action.target as { urlTemplate: string };
  assert.equal(target.urlTemplate, `${ORIGIN}/search?q={search_term_string}`);
  assert.equal(action["query-input"], "required name=search_term_string");

  assert.equal(graph[1]["@type"], "Organization");
  assert.equal(graph[1].name, "Signal Garden");
  assert.equal(graph[1].url, ORIGIN);
  assert.equal(graph[1].email, "hello@signalgarden.site");
  const logo = graph[1].logo as { "@type": string; url: string };
  assert.equal(logo["@type"], "ImageObject");
  assert.equal(logo.url, `${ORIGIN}/logo-email.png`);
  assert.deepEqual(graph[1].sameAs, ["https://github.com/lbr2713339877-rgb/signal-garden"]);

  const without = siteJsonLd({ origin: ORIGIN, search: false });
  const site = (without["@graph"] as Record<string, unknown>[])[0];
  assert.equal(site.potentialAction, undefined);
});

test("today ItemList ranks repos with position, project url, and name", () => {
  const data = todayItemList(
    [
      { name: "Alpha <Beta>", slug: "alpha" },
      { name: "Gamma", slug: "a b" },
    ],
    ORIGIN,
    "2026-10-18",
  );
  const items = data.itemListElement as Record<string, unknown>[];
  assert.equal(data["@type"], "ItemList");
  assert.equal(data.name, "Signal Garden — Today 2026-10-18");
  assert.equal(data.url, "https://signalgarden.site/today");
  assert.equal(items[0]["@type"], "ListItem");
  assert.equal(items[0].position, 1);
  assert.equal(items[0].name, "Alpha <Beta>");
  assert.equal(items[0].url, "https://signalgarden.site/p/alpha");
  assert.equal(items[1].position, 2);
  assert.equal(items[1].url, "https://signalgarden.site/p/a%20b");
});

test("project JSON-LD is SoftwareSourceCode plus a breadcrumb", () => {
  const data = projectJsonLd({
    name: "oil-ui",
    description: "把界面方案摆到一起。",
    slug: "oil-ui",
    codeRepository: "https://github.com/acme/oil-ui",
    origin: ORIGIN,
    programmingLanguage: "TypeScript",
    license: "MIT",
    author: "acme",
    forks7d: 12,
  });
  const graph = data["@graph"] as Record<string, unknown>[];
  assert.equal(graph[0]["@type"], "SoftwareSourceCode");
  assert.equal(graph[0].name, "oil-ui");
  assert.equal(graph[0].description, "把界面方案摆到一起。");
  assert.equal(graph[0].codeRepository, "https://github.com/acme/oil-ui");
  assert.equal(graph[0].url, "https://signalgarden.site/p/oil-ui");
  assert.equal(graph[0].programmingLanguage, "TypeScript");
  assert.equal(graph[0].license, "MIT");
  assert.deepEqual(graph[0].author, { "@type": "Person", name: "acme", url: "https://github.com/acme" });
  assert.deepEqual(graph[0].additionalProperty, { "@type": "PropertyValue", name: "7-day new forks", value: 12 });
  assert.equal(graph[1]["@type"], "BreadcrumbList");
  const crumbs = graph[1].itemListElement as Record<string, unknown>[];
  assert.deepEqual(crumbs.map((c) => c.position), [1, 2, 3]);
  assert.equal(crumbs[2].name, "oil-ui");
  assert.equal(crumbs[2].item, "https://signalgarden.site/p/oil-ui");
});

test("codeRepository is a GitHub URL and is omitted otherwise", () => {
  assert.equal(githubCodeRepository("https://github.com/acme/tool"), "https://github.com/acme/tool");
  assert.equal(githubCodeRepository("https://example.com", "acme/tool"), "https://github.com/acme/tool");
  assert.equal(githubCodeRepository("https://example.com", null), null);
  const data = projectJsonLd({
    name: "Site",
    description: "A website.",
    slug: "site",
    origin: ORIGIN,
  });
  const code = (data["@graph"] as Record<string, unknown>[])[0];
  assert.equal("codeRepository" in code, false);
  assert.equal("programmingLanguage" in code, false);
  assert.equal("license" in code, false);
  assert.equal("author" in code, false);
  assert.equal("additionalProperty" in code, false);
});

test("json-ld escapes < so a value cannot close the script tag", () => {
  const html = jsonLdHtml({ name: "a <b> </script> c" });
  assert.equal(html.includes("<"), false);
  assert.match(html, /\\u003c/);
  assert.equal(JSON.parse(html).name, "a <b> </script> c");
});
