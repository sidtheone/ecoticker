import type { Metadata } from "next";
import TopicList from "@/components/TopicList";
import HeroSection from "@/components/HeroSection";
import { selectHeroTopic, computeHeadline } from "@/lib/utils";
import { db } from "@/db";
import { topics } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Topic } from "@/lib/types";

export const metadata: Metadata = {
  title: { absolute: "EcoTicker — Environmental Impact Tracker" },
  description:
    "Real-time AI-scored severity tracking for environmental news. Monitor climate, pollution, biodiversity, and more.",
  openGraph: {
    title: "EcoTicker — Environmental Impact Tracker",
    description:
      "Real-time AI-scored severity tracking for environmental news.",
    url: "/",
    images: [{ url: "/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "EcoTicker — Environmental Impact Tracker",
    description:
      "Real-time AI-scored severity tracking for environmental news.",
    images: ["/og-default.png"],
  },
};

export const dynamic = "force-dynamic";

export default async function Home() {
  let heroTopic: Topic | null = null;
  let restTopics: Topic[] = [];
  let headline: string | undefined;

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
    headline = mapped.length > 0 ? computeHeadline(mapped) : undefined;
    restTopics = mapped
      .filter((t) => t.id !== heroTopic?.id)
      .sort((a, b) => b.currentScore - a.currentScore);
  } catch {
    // DB failure — render with null heroTopic (fallback UI)
  }

  return (
    <div>
      <p className="text-sm text-stone-500 dark:text-gray-400 mb-4">
        Environmental News Impact Tracker — AI-Scored Severity
      </p>
      <div className="mb-8">
        <HeroSection heroTopic={heroTopic} headline={headline} />
      </div>
      <section>
        <h2 className="sr-only">Environmental Topics</h2>
        <TopicList topics={restTopics} />
      </section>
    </div>
  );
}
