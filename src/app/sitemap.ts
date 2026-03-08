import type { MetadataRoute } from "next";
import { db } from "@/db";
import { topics } from "@/db/schema";
import { eq } from "drizzle-orm";

const BASE = "https://ecoticker.sidsinsights.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let topicUrls: MetadataRoute.Sitemap = [];

  try {
    const rows = await db
      .select({ slug: topics.slug, updatedAt: topics.updatedAt })
      .from(topics)
      .where(eq(topics.hidden, false));

    topicUrls = rows.map((r) => ({
      url: `${BASE}/topic/${r.slug}`,
      lastModified: r.updatedAt ?? new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    }));
  } catch {
    // DB unavailable — return static routes only
  }

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/scoring`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/data-policy`, changeFrequency: "monthly", priority: 0.3 },
    ...topicUrls,
  ];
}
