import TopicGrid from "@/components/TopicGrid";
import HeroSection from "@/components/HeroSection";
import { selectHeroTopic } from "@/lib/utils";
import { db } from "@/db";
import { topics } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Topic } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let heroTopic: Topic | null = null;

  try {
    const rows = await db
      .select()
      .from(topics)
      .where(eq(topics.hidden, false));

    const mapped: Topic[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      category: (r.category ?? "climate") as Topic["category"],
      region: r.region,
      currentScore: r.currentScore ?? 0,
      previousScore: r.previousScore ?? 0,
      change: (r.currentScore ?? 0) - (r.previousScore ?? 0),
      urgency: (r.urgency ?? "informational") as Topic["urgency"],
      impactSummary: r.impactSummary,
      imageUrl: r.imageUrl,
      articleCount: r.articleCount ?? 0,
      healthScore: r.healthScore ?? 0,
      ecoScore: r.ecoScore ?? 0,
      econScore: r.econScore ?? 0,
      scoreReasoning: r.scoreReasoning ?? null,
      hidden: r.hidden ?? false,
      updatedAt: r.updatedAt?.toISOString() ?? new Date().toISOString(),
      sparkline: [],
    }));

    heroTopic = selectHeroTopic(mapped);
  } catch {
    // DB failure — render with null heroTopic (fallback UI)
  }

  return (
    <div>
      <p className="text-sm text-stone-500 dark:text-gray-400 mb-4">
        Environmental News Impact Tracker — AI-Scored Severity
      </p>
      <div className="mb-8">
        <HeroSection heroTopic={heroTopic} />
      </div>
<TopicGrid />
    </div>
  );
}
