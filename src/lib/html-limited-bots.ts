/**
 * User agents that must receive fully rendered metadata in the HTML head.
 *
 * Setting `htmlLimitedBots` replaces Next's default list, so that source is
 * included here. Googlebot is not in the default (Next treats it as
 * JavaScript-capable and streams metadata). Social and AI crawlers that
 * read the initial HTML are listed as well. Next recompiles `.source`
 * with the `i` flag.
 */
const NEXT_DEFAULT_SOURCE =
  "[\\w-]+-Google|Google-[\\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight";

const EXTRA_CRAWLERS = [
  "Googlebot",
  "Googlebot-Image",
  "Googlebot-News",
  "Googlebot-Video",
  "AdsBot-Google",
  "Mediapartners-Google",
  "FeedFetcher-Google",
  "msnbot",
  "Bingbot",
  "Twitterbot",
  "facebookexternalhit",
  "Facebot",
  "LinkedInBot",
  "Slackbot",
  "Slack-ImgProxy",
  "Discordbot",
  "WhatsApp",
  "TelegramBot",
  "Pinterestbot",
  "redditbot",
  "Embedly",
  "Iframely",
  "Applebot",
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Amazonbot",
  "Bytespider",
  "CCBot",
  "cohere-ai",
  "Meta-ExternalAgent",
  "Meta-ExternalFetcher",
  "FacebookBot",
  "YouBot",
  "Diffbot",
  "DuckAssistBot",
  "ImagesiftBot",
].join("|");

export const HTML_LIMITED_BOTS_SOURCE = `${NEXT_DEFAULT_SOURCE}|${EXTRA_CRAWLERS}`;

export const HTML_LIMITED_BOTS = new RegExp(HTML_LIMITED_BOTS_SOURCE, "i");
