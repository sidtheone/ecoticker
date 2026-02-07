import type { Urgency } from "@/lib/types";
import { urgencyColor } from "@/lib/utils";

export default function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const colors = urgencyColor(urgency);
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${colors.text} ${colors.bg} ${colors.border} border`}
      data-testid="urgency-badge"
    >
      {urgency}
    </span>
  );
}
