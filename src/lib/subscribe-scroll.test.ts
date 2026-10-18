import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import nextConfig from "../../next.config";
import { confirmPageUrl } from "./newsletter/headers";
import {
  nextSubscribeAttempt,
  runSubscribeScroll,
  subscribeHref,
  type SubscribeDom,
} from "./subscribe-scroll";
import { scheduleTurnstileRender } from "../components/v3/turnstile-widget";

test("subscribe links target the homepage form and keep the campaign", () => {
  assert.equal(
    subscribeHref("project_page"),
    "/?utm_source=signalgarden&utm_medium=project_page&utm_campaign=subscribe#subscribe",
  );
  assert.equal(nextSubscribeAttempt({ hash: "#subscribe", hasTarget: false, elapsedMs: 0 }), "wait");
  assert.equal(nextSubscribeAttempt({ hash: "#subscribe", hasTarget: true, elapsedMs: 0 }), "scroll");
  assert.equal(nextSubscribeAttempt({ hash: "#subscribe", hasTarget: false, elapsedMs: 3000 }), "stop");
  assert.equal(nextSubscribeAttempt({ hash: "", hasTarget: true, elapsedMs: 0 }), "stop");
});

test("scroll retries until the form exists, then focuses the email field", () => {
  let now = 0;
  let target: HTMLElement | null = null;
  const input = { focusCount: 0 } as HTMLElement & { focusCount: number };
  const scrolls: HTMLElement[] = [];
  const frames: Array<() => void> = [];
  const timers: Array<() => void> = [];
  const dom: SubscribeDom = {
    hash: () => "#subscribe",
    target: () => target,
    emailInput: () => (target ? input : null),
    scroll: (element) => scrolls.push(element),
    focus: (element) => {
      (element as HTMLElement & { focusCount: number }).focusCount += 1;
    },
    now: () => now,
    frame: (fn) => {
      frames.push(fn);
      return frames.length;
    },
    later: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    cancelFrame: () => undefined,
    cancelLater: () => undefined,
  };
  const section = { id: "subscribe" } as HTMLElement;
  runSubscribeScroll(dom, 3000);
  assert.equal(scrolls.length, 0);
  assert.equal(frames.length, 1);
  frames.shift()?.();
  assert.equal(timers.length, 1);
  target = section;
  now = 80;
  timers.shift()?.();
  assert.equal(scrolls[0], section);
  assert.equal(input.focusCount, 1);
  assert.equal(frames.length, 0);
  assert.equal(timers.length, 1);
  now = 330;
  timers.shift()?.();
  assert.equal(scrolls.length, 2);
  assert.equal(input.focusCount, 2);
  assert.equal(frames.length + timers.length, 0);
});

test("a missing hash does not scroll", () => {
  let frames = 0;
  runSubscribeScroll({
    hash: () => "",
    target: () => ({ id: "subscribe" }) as HTMLElement,
    emailInput: () => null,
    scroll: () => assert.fail("scrolled"),
    focus: () => assert.fail("focused"),
    now: () => 0,
    frame: () => {
      frames += 1;
      return 1;
    },
    later: () => 1,
    cancelFrame: () => undefined,
    cancelLater: () => undefined,
  });
  assert.equal(frames, 0);
});

test("turnstile render waits until the form host mounts", () => {
  let host: HTMLElement | null = null;
  let rendered = 0;
  let now = 0;
  const pending: Array<() => void> = [];
  const job = scheduleTurnstileRender({
    getHost: () => host,
    render: () => {
      rendered += 1;
    },
    now: () => now,
    later: (fn) => {
      pending.push(fn);
      return pending.length;
    },
    budgetMs: 3000,
  });
  assert.equal(rendered, 0);
  host = {} as HTMLElement;
  pending.shift()?.();
  assert.equal(rendered, 1);
  job.cancel();
  pending.shift()?.();
  assert.equal(rendered, 1);

  now = 0;
  host = null;
  const late: Array<() => void> = [];
  scheduleTurnstileRender({
    getHost: () => null,
    render: () => assert.fail("rendered after the budget"),
    now: () => now,
    later: (fn) => {
      late.push(fn);
      return 1;
    },
    budgetMs: 100,
  });
  now = 100;
  late.shift()?.();
});

test("subscribe and newsletter aliases redirect home without swallowing confirm", async () => {
  assert.equal(typeof nextConfig.redirects, "function");
  const rules = await nextConfig.redirects!();
  for (const source of ["/subscribe", "/subscribe/", "/newsletter", "/newsletter/"]) {
    const rule = rules.find((item) => item.source === source);
    assert.equal(rule?.destination, "/#subscribe");
    assert.equal(rule?.permanent, true);
  }
  assert.equal(rules.some((item) => item.source === "/subscribe/confirm"), false);
  assert.equal(rules.some((item) => String(item.source).includes("/subscribe/:path")), false);
});

test("confirm, welcome and weekly mail use live routes", () => {
  assert.equal(confirmPageUrl("https://signalgarden.site", "tok en"), "https://signalgarden.site/subscribe/confirm?t=tok%20en");
  const confirm = readFileSync(new URL("../emails/Confirm.tsx", import.meta.url), "utf8");
  const welcome = readFileSync(new URL("../emails/Welcome.tsx", import.meta.url), "utf8");
  const weekly = readFileSync(new URL("../emails/newsletter-weekly.tsx", import.meta.url), "utf8");
  const subscribe = readFileSync(new URL("./newsletter/subscribe.ts", import.meta.url), "utf8");
  assert.match(confirm, /\/subscribe\/confirm\?t=/);
  assert.match(welcome, /todayUrl/);
  assert.match(subscribe, /todayUrl: `\$\{siteUrl\}\/today`/);
  assert.match(weekly, /\/today/);
  assert.match(weekly, /\/unsubscribe/);
  assert.doesNotMatch(`${confirm}\n${welcome}\n${weekly}`, /href=["'][^"']*\/newsletter/);
  assert.doesNotMatch(confirm, /href=["']\/subscribe["']/);
  const project = readFileSync(new URL("../app/p/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(project, /<SubscribeLink[\s\S]*medium="project_page"/);
  assert.doesNotMatch(project, /campaign=subscribe#subscribe/);
});
