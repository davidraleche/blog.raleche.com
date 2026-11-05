import type { MetadataRoute } from "next";
import { absUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

const PRIVATE = ["/admin", "/account", "/api/", "/signin", "/unsubscribe"];

// AI search and answer engines we explicitly welcome, so they can cite RALECHE.
const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot", "Applebot-Extended", "Bingbot", "DuckAssistBot",
  "Amazonbot", "meta-externalagent", "MistralAI-User", "cohere-ai", "YouBot", "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_BOTS, allow: ["/", "/llms.txt", "/llms-full.txt", "/md/"], disallow: PRIVATE },
    ],
    sitemap: absUrl("/sitemap.xml"),
    host: absUrl("/"),
  };
}
