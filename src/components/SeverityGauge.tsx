import { severityColor } from "@/lib/utils";

interface SeverityGaugeProps {
  score: number;
  compact?: boolean;
}

export default function SeverityGauge({ score, compact }: SeverityGaugeProps) {
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
        className="d8-card-gauge"
        data-testid="gauge-bar"
      >
        <div
          className="d8-card-gauge-fill"
          style={{ width: `${clampedScore}%`, background: colors.gauge }}
        />
      </div>
    );
  }

  return (
    <div
      role="meter"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Severity: ${colors.text}`}
      className="d8-gauge"
      data-testid="gauge-bar"
    >
      <div
        className="d8-gauge-fill"
      />
      <div
        data-testid="gauge-marker"
        className="d8-gauge-marker"
        style={{ left: `calc(${clampedScore}% - 1.5px)` }}
      />
    </div>
  );
}
