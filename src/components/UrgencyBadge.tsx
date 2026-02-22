import { severityColor, scoreToUrgency } from "@/lib/utils";

export default function UrgencyBadge({ score }: { score: number }) {
  const colors = severityColor(score);
  const urgency = scoreToUrgency(score);
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase border"
      style={{
        color: colors.badge,
        backgroundColor: `${colors.badge}1a`,
        borderColor: `${colors.badge}33`,
      }}
      data-testid="urgency-badge"
    >
      {urgency}
    </span>
  );
}
