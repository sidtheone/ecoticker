import { ImageResponse } from "next/og";
import { db } from "@/db";
import { topics } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

function severityColor(score: number) {
  if (score >= 80) return { color: "#dc2626", label: "Breaking" };
  if (score >= 60) return { color: "#c2410c", label: "Critical" };
  if (score >= 30) return { color: "#a16207", label: "Moderate" };
  return { color: "#15803d", label: "Informational" };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const rows = await db
      .select({
        name: topics.name,
        currentScore: topics.currentScore,
        urgency: topics.urgency,
      })
      .from(topics)
      .where(eq(topics.slug, slug))
      .limit(1);

    const topic = rows[0];

    if (!topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    const score = topic.currentScore ?? 0;
    const { color, label } = severityColor(score);

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            height: "100%",
            backgroundColor: "#faf7f2",
            padding: "60px",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {/* Accent bar at top */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "8px",
              backgroundColor: color,
            }}
          />

          {/* Branding */}
          <div
            style={{
              display: "flex",
              fontSize: "24px",
              color: "#78716c",
              marginBottom: "32px",
              letterSpacing: "0.05em",
            }}
          >
            EcoTicker
          </div>

          {/* Topic name */}
          <div
            style={{
              display: "flex",
              fontSize: "48px",
              fontWeight: 700,
              color: "#292524",
              textAlign: "center",
              lineHeight: 1.2,
              marginBottom: "40px",
              maxWidth: "900px",
            }}
          >
            {topic.name}
          </div>

          {/* Score */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "120px",
                fontWeight: 800,
                color,
                lineHeight: 1,
              }}
            >
              {score}
            </div>

            {/* Urgency badge */}
            <div
              style={{
                display: "flex",
                fontSize: "28px",
                fontWeight: 600,
                color,
                backgroundColor: `${color}1a`,
                border: `3px solid ${color}33`,
                borderRadius: "12px",
                padding: "8px 24px",
                textTransform: "uppercase",
              }}
            >
              {label}
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
