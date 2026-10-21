import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { shouldServeStreamingMetadata } from "next/dist/server/lib/streaming-metadata.js";
import { HTML_LIMITED_BOTS } from "./html-limited-bots";

const BLOCKING = [
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/120.0.0.0 Safari/537.36",
  "Googlebot-Image/1.0",
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  "Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  "Twitterbot/1.0",
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "LinkedInBot/1.0",
  "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
  "Discordbot/2.0",
  "WhatsApp/2.23.20.0",
  "TelegramBot (like TwitterBot)",
  "Pinterestbot/1.0",
  "GPTBot/1.2 (+https://openai.com/gptbot)",
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
  "OAI-SearchBot/1.0",
  "ClaudeBot/1.0",
  "Claude-SearchBot/1.0",
  "PerplexityBot/1.0",
  "Amazonbot/0.1",
  "Bytespider",
  "CCBot/2.0",
  "Meta-ExternalAgent/1.1",
  "Applebot/0.1",
  "Mozilla/5.0 (compatible; Mediapartners-Google/2.1; +http://www.google.com/bot.html)",
];

const STREAMING = [
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
];

test("crawlers get blocking metadata and browsers still stream", () => {
  for (const ua of BLOCKING) {
    assert.equal(HTML_LIMITED_BOTS.test(ua), true, ua);
    assert.equal(shouldServeStreamingMetadata(ua, HTML_LIMITED_BOTS.source), false, ua);
  }
  for (const ua of STREAMING) {
    assert.equal(HTML_LIMITED_BOTS.test(ua), false, ua);
    assert.equal(shouldServeStreamingMetadata(ua, HTML_LIMITED_BOTS.source), true, ua);
  }
});

test("next config replaces the default bot list with this pattern", () => {
  const config = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /htmlLimitedBots:\s*HTML_LIMITED_BOTS/);
  assert.match(config, /html-limited-bots/);
});
