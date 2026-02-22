import { severityColor } from "@/lib/utils";

interface SeverityGaugeProps {
  score: number;
  compact?: boolean;
  height?: number;
}

export default function SeverityGauge({ score, compact, height }: SeverityGaugeProps) {
  const colors = severityColor(score);
  const clampedScore = Math.max(0, Math.min(100, score));

  if (compact) {
    return (
      <div
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Severity: ${colors.text}`}
        style={{
          height: "8px",
          borderRadius: "4px",
          backgroundColor: colors.gauge,
        }}
        data-testid="gauge-bar"
      />
    );
  }

  return (
    <div
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Severity: ${colors.text}`}
      style={{
        position: "relative",
        minWidth: "120px",
        height: `${height ?? 8}px`,
        borderRadius: "4px",
        background: "linear-gradient(to right, #15803d 0%, #854d0e 30%, #9a3412 60%, #991b1b 80%, #991b1b 100%)",
      }}
      data-testid="gauge-bar"
    >
      <div
        data-testid="gauge-marker"
        style={{
          position: "absolute",
          left: `${clampedScore}%`,
          top: "-3px",
          width: "0",
          height: "0",
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: "6px solid #1e293b",
          transform: "translateX(-5px)",
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
        }}
      />
    </div>
  );
}
