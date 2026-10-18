import { llmsTxt } from "@/lib/llms";

export const dynamic = "force-dynamic";

/** Agent-readable site briefing. Same origin as the public site. */
export function GET() {
  return new Response(llmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
