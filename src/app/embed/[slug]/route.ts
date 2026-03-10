import { db } from "@/db";
import { topics } from "@/db/schema";
import { eq } from "drizzle-orm";
import { severityColor, scoreToUrgency } from "@/lib/utils";

/**
 * Embeddable topic widget — returns self-contained HTML for iframing.
 * No header, footer, or ticker bar. Minimal JS. Server-rendered.
 *
 * Query params:
 *   - theme=dark — dark background variant
 *
 * Headers:
 *   - X-Frame-Options: ALLOWALL
 *   - Content-Security-Policy: frame-ancestors *
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const theme = url.searchParams.get("theme");
  const isDark = theme === "dark";

  const rows = await db
    .select({
      name: topics.name,
      slug: topics.slug,
      currentScore: topics.currentScore,
      urgency: topics.urgency,
    })
    .from(topics)
    .where(eq(topics.slug, slug))
    .limit(1);

  const topic = rows[0];

  if (!topic) {
    return new Response("Not Found", { status: 404 });
  }

  const score = topic.currentScore ?? 0;
  const urgencyLabel = (topic.urgency ?? scoreToUrgency(score)).toUpperCase();
  const colors = severityColor(score);

  // Theme colors
  const bg = isDark ? "#1a1a2e" : "#faf7f2";
  const fg = isDark ? "#e0e0e0" : "#1c1917";
  const mutedFg = isDark ? "#9ca3af" : "#78716c";
  const gaugeBg = isDark ? "#374151" : "#e7e5e4";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(topic.name)} — EcoTicker</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: ${bg};
      color: ${fg};
      padding: 12px 16px;
      min-height: 100vh;
    }
    .widget { display: flex; flex-direction: column; gap: 8px; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .name { font-size: 14px; font-weight: 600; line-height: 1.3; flex: 1; }
    .score-block { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .score { font-size: 28px; font-weight: 700; font-family: ui-monospace, monospace; color: ${colors.badge}; }
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px;
      font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
      color: ${colors.badge}; background: ${colors.badge}1a; border: 1px solid ${colors.badge}33;
    }
    .gauge { height: 4px; border-radius: 2px; background: ${gaugeBg}; width: 100%; overflow: hidden; }
    .gauge-fill { height: 100%; border-radius: 2px; background: ${colors.gauge}; transition: width 0.3s; }
    .footer { display: flex; align-items: center; justify-content: space-between; margin-top: 2px; }
    .powered { font-size: 10px; color: ${mutedFg}; text-decoration: none; }
    .powered:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="widget">
    <div class="header">
      <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;">
        <span class="badge">${urgencyLabel}</span>
        <span class="name">${escapeHtml(topic.name)}</span>
      </div>
      <div class="score-block">
        <span class="score">${score}</span>
      </div>
    </div>
    <div class="gauge"><div class="gauge-fill" style="width: ${Math.max(0, Math.min(100, score))}%"></div></div>
    <div class="footer">
      <a class="powered" href="https://ecoticker.sidsinsights.com" target="_blank" rel="noopener">Powered by EcoTicker</a>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "ALLOWALL",
      "Content-Security-Policy": "frame-ancestors *",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
