import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "EcoTicker — Environmental Impact Tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#292524",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Severity gauge bar at top */}
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "8px",
            borderRadius: "4px",
            position: "absolute",
            top: "0",
            left: "0",
            background: "linear-gradient(90deg, #15803d, #a16207, #c2410c, #dc2626)",
          }}
        />

        {/* Logo + title */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "72px",
              height: "72px",
              borderRadius: "14px",
              backgroundColor: "#faf7f2",
            }}
          >
            <span style={{ fontSize: "44px", fontWeight: 800, color: "#292524" }}>E</span>
          </div>
          <span style={{ fontSize: "64px", fontWeight: 800, color: "#faf7f2", letterSpacing: "-2px" }}>
            EcoTicker
          </span>
        </div>

        {/* Subtitle */}
        <p style={{ fontSize: "28px", color: "#a8a29e", marginTop: "24px", lineHeight: 1.4 }}>
          Environmental News Impact Tracker
        </p>
        <p style={{ fontSize: "22px", color: "#78716c", marginTop: "8px" }}>
          AI-scored severity across health, ecology, and economy
        </p>

        {/* Mini severity indicators */}
        <div style={{ display: "flex", gap: "16px", marginTop: "48px" }}>
          {[
            { label: "BREAKING", color: "#dc2626" },
            { label: "CRITICAL", color: "#c2410c" },
            { label: "MODERATE", color: "#a16207" },
            { label: "INFORMATIONAL", color: "#15803d" },
          ].map((level) => (
            <div
              key={level.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "6px",
                backgroundColor: "rgba(255,255,255,0.06)",
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: level.color,
                }}
              />
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#d6d3d1", letterSpacing: "1px" }}>
                {level.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
