import { ImageResponse } from "next/og";
import { db } from "@/db";
import { topics } from "@/db/schema";
import { eq } from "drizzle-orm";

export const alt = "EcoTicker Topic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 43200; // Cache for 12 hours (scores update twice daily)

const urgencyConfig: Record<string, { color: string; label: string }> = {
  breaking: { color: "#dc2626", label: "BREAKING" },
  critical: { color: "#c2410c", label: "CRITICAL" },
  moderate: { color: "#a16207", label: "MODERATE" },
  informational: { color: "#15803d", label: "INFORMATIONAL" },
};

export default async function TopicOGImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let name = "Topic Not Found";
  let score = 0;
  let urgency = "informational";
  let healthScore = 0;
  let ecoScore = 0;
  let econScore = 0;
  let summary = "";

  try {
    const rows = await db
      .select({
        name: topics.name,
        currentScore: topics.currentScore,
        urgency: topics.urgency,
        healthScore: topics.healthScore,
        ecoScore: topics.ecoScore,
        econScore: topics.econScore,
        impactSummary: topics.impactSummary,
      })
      .from(topics)
      .where(eq(topics.slug, slug))
      .limit(1);

    if (rows[0]) {
      name = rows[0].name;
      score = rows[0].currentScore ?? 0;
      urgency = rows[0].urgency ?? "informational";
      healthScore = rows[0].healthScore ?? 0;
      ecoScore = rows[0].ecoScore ?? 0;
      econScore = rows[0].econScore ?? 0;
      summary = (rows[0].impactSummary ?? "").substring(0, 120);
    }
  } catch {
    // Render fallback card on DB error
  }

  const config = urgencyConfig[urgency] ?? urgencyConfig.informational;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 80px",
          backgroundColor: "#292524",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Urgency color bar at top */}
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "8px",
            position: "absolute",
            top: "0",
            left: "0",
            backgroundColor: config.color,
          }}
        />

        {/* Top section: urgency badge + EcoTicker */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 20px",
              borderRadius: "6px",
              backgroundColor: config.color + "20",
              border: `2px solid ${config.color}`,
            }}
          >
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: config.color,
              }}
            />
            <span style={{ fontSize: "16px", fontWeight: 700, color: config.color, letterSpacing: "1px" }}>
              {config.label}
            </span>
          </div>
          <span style={{ fontSize: "20px", fontWeight: 600, color: "#78716c" }}>
            EcoTicker
          </span>
        </div>

        {/* Middle: topic name + score */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <span style={{ fontSize: "52px", fontWeight: 800, color: "#faf7f2", letterSpacing: "-1px", lineHeight: 1.1 }}>
            {name}
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "16px" }}>
            <span style={{ fontSize: "72px", fontWeight: 800, color: config.color }}>
              {score}
            </span>
            <span style={{ fontSize: "24px", color: "#a8a29e" }}>/ 100</span>
          </div>
          {summary && (
            <p style={{ fontSize: "20px", color: "#a8a29e", lineHeight: 1.4, margin: 0 }}>
              {summary}
            </p>
          )}
        </div>

        {/* Bottom: dimension scores */}
        <div style={{ display: "flex", gap: "32px" }}>
          {[
            { label: "Ecological", score: ecoScore, weight: "40%" },
            { label: "Health", score: healthScore, weight: "35%" },
            { label: "Economic", score: econScore, weight: "25%" },
          ].map((dim) => (
            <div
              key={dim.label}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                padding: "12px 24px",
                borderRadius: "8px",
                backgroundColor: "rgba(255,255,255,0.06)",
              }}
            >
              <span style={{ fontSize: "14px", color: "#78716c", letterSpacing: "0.5px" }}>
                {dim.label} ({dim.weight})
              </span>
              <span style={{ fontSize: "28px", fontWeight: 700, color: "#faf7f2" }}>
                {dim.score}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
