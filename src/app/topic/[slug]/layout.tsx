import type { Metadata } from "next";
import { db } from "@/db";
import { topics } from "@/db/schema";
import { eq } from "drizzle-orm";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const [topic] = await db
    .select({
      name: topics.name,
      currentScore: topics.currentScore,
      urgency: topics.urgency,
      impactSummary: topics.impactSummary,
      scoreReasoning: topics.scoreReasoning,
    })
    .from(topics)
    .where(eq(topics.slug, slug))
    .limit(1);

  if (!topic) {
    return { title: "Topic Not Found — EcoTicker" };
  }

  const title = `${topic.name} — Score: ${topic.currentScore} (${topic.urgency}) | EcoTicker`;
  const description = (topic.impactSummary || topic.scoreReasoning || "")
    .substring(0, 200);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/topic/${slug}`,
      images: [{ url: "/og-default.png", width: 1200, height: 630 }],
      siteName: "EcoTicker",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-default.png"],
    },
  };
}

export default function TopicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
