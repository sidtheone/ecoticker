import "dotenv/config"; // Load .env for standalone script
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { scoreToLevel, computeOverallScore, deriveUrgency } from "../src/lib/scoring";

const { topics, articles, scoreHistory, topicKeywords } = schema;

// ─────────────────────────────────────────────────────────────────
// DB SETUP
// ─────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

// ─────────────────────────────────────────────────────────────────
// SEED DATA (v2 - Multi-dimensional scoring)
// ─────────────────────────────────────────────────────────────────

/**
 * Seed topics with realistic v2 data:
 * - All severity levels represented (MINIMAL, MODERATE, SIGNIFICANT, SEVERE)
 * - Realistic reasoning text (not lorem ipsum)
 * - At least 1 topic with INSUFFICIENT_DATA dimension
 * - 7 days of score history with levels and abbreviated reasoning
 */
const seedTopics = [
  // SEVERE overall (breaking urgency)
  {
    name: "Amazon Deforestation Acceleration",
    slug: "amazon-deforestation-acceleration",
    category: "deforestation",
    region: "South America",
    // Eco-driven SEVERE
    healthScore: 28, healthLevel: "MODERATE" as const,
    healthReasoning: "Indirect health impacts on indigenous communities through habitat loss and reduced access to traditional medicines. Air quality degradation from burning affects respiratory health in nearby settlements.",
    ecoScore: 88, ecoLevel: "SEVERE" as const,
    ecoReasoning: "Satellite imagery confirms 12,000 km² of forest loss in 2025, the highest rate in 15 years. The Amazon stores approximately 150-200 billion tons of carbon, and continued deforestation threatens to push the ecosystem past a tipping point into savanna-like conditions.",
    econScore: 62, econLevel: "SIGNIFICANT" as const,
    econReasoning: "Global timber markets disrupted. Indigenous communities lose primary income sources. Carbon credit markets face $8B valuation crisis. Long-term agricultural land degradation threatens Brazilian exports.",
    overallSummary: "Unprecedented Amazon deforestation rate threatens irreversible ecosystem collapse and global carbon cycle disruption.",
    keywords: ["amazon", "deforestation", "brazil", "rainforest", "carbon sink"],
  },
  {
    name: "Delhi Air Quality Emergency",
    slug: "delhi-air-quality-emergency",
    category: "air_quality",
    region: "South Asia",
    // Health-driven SEVERE
    healthScore: 85, healthLevel: "SEVERE" as const,
    healthReasoning: "PM2.5 concentrations exceeded 500 µg/m³ for three consecutive days, 33x the WHO guideline. Schools closed across the NCR region. Emergency hospital admissions for respiratory illness increased 40% compared to the same period last year.",
    ecoScore: 35, ecoLevel: "MODERATE" as const,
    ecoReasoning: "Urban air pollution has localized ecosystem effects including vegetation stress and reduced photosynthesis efficiency. No evidence of ecosystem collapse or mass biodiversity loss. Effects are reversible with air quality improvement.",
    econScore: 48, econLevel: "MODERATE" as const,
    econReasoning: "Schools closed for 5 days, affecting working parents. Healthcare costs spiked. Tourism industry reported 15% cancellations. Construction sector halted, delaying infrastructure projects worth $2B.",
    overallSummary: "Hazardous air quality crisis in Delhi poses severe public health emergency with mass respiratory illness and school closures.",
    keywords: ["delhi", "air quality", "pollution", "smog", "pm2.5"],
  },

  // SIGNIFICANT overall (critical urgency)
  {
    name: "Great Barrier Reef Coral Bleaching",
    slug: "great-barrier-reef-coral-bleaching",
    category: "ocean",
    region: "Oceania",
    // Eco-driven SIGNIFICANT
    healthScore: 28, healthLevel: "MODERATE" as const,
    healthReasoning: "No direct human health effects. Indirect impacts on coastal communities include reduced food security from declining fisheries and mental health concerns among indigenous populations culturally tied to the reef.",
    ecoScore: 72, ecoLevel: "SIGNIFICANT" as const,
    ecoReasoning: "Widespread bleaching affecting 60% of the world's largest coral reef system. Repeated bleaching events over consecutive years prevent recovery. Cascading effects on marine biodiversity well-documented, with 1500+ dependent species at risk.",
    econScore: 58, econLevel: "SIGNIFICANT" as const,
    econReasoning: "Reef tourism generates $6.4B annually for Queensland. Fisheries decline affects thousands of livelihoods. Reef restoration efforts cost $200M+ annually. International diving tourism bookings down 25%.",
    overallSummary: "Mass coral bleaching threatens Great Barrier Reef ecosystem integrity and Australia's marine tourism economy.",
    keywords: ["coral", "bleaching", "reef", "ocean temperature", "marine"],
  },
  {
    name: "California Wildfire Risk Escalation",
    slug: "california-wildfire-risk-escalation",
    category: "climate",
    region: "North America",
    // Health-driven SIGNIFICANT
    healthScore: 55, healthLevel: "SIGNIFICANT" as const,
    healthReasoning: "Wildfire smoke exposure affects millions across California and neighboring states. Emergency departments report 30% increase in asthma and COPD admissions. Firefighter injuries and heat exhaustion cases rising. Evacuations disrupt medical care access.",
    ecoScore: 48, ecoLevel: "MODERATE" as const,
    ecoReasoning: "Forest ecosystems experience localized destruction but natural regeneration expected in 5-10 years. Soil erosion and watershed contamination documented. Wildlife displacement temporary. No evidence of species extinctions.",
    econScore: 45, econLevel: "MODERATE" as const,
    econReasoning: "Homeowner insurance premiums increased 40% statewide. $1.5B in property damage from 2025 fires. Evacuation costs strain local budgets. Tourism sector in fire-prone regions down 20%.",
    overallSummary: "Wildfire season intensifies across California, creating widespread health impacts and economic strain.",
    keywords: ["wildfire", "california", "drought", "fire", "smoke"],
  },
  {
    name: "Congo Basin Industrial Mining Expansion",
    slug: "congo-basin-industrial-mining-expansion",
    category: "biodiversity",
    region: "Central Africa",
    // Eco + Econ driven SIGNIFICANT
    healthScore: 22, healthLevel: "MINIMAL" as const,
    healthReasoning: "Mining operations expose workers to silica dust and heavy metals, but safety protocols limit mass exposure. Local communities report water contamination concerns, though no large-scale disease outbreaks documented.",
    ecoScore: 72, ecoLevel: "SIGNIFICANT" as const,
    ecoReasoning: "Industrial mining expansion threatens critical gorilla and okapi habitats. Deforestation fragmenting protected areas. Mercury and cyanide runoff contaminating river systems. 15% increase in forest loss within mining concessions.",
    econScore: 55, econLevel: "SIGNIFICANT" as const,
    econReasoning: "Mining operations create 8,000 jobs but displace subsistence farmers. Cobalt and copper exports worth $4B annually. Indigenous land rights conflicts escalating. Long-term soil degradation threatens agricultural productivity.",
    overallSummary: "Industrial mining expansion in Congo Basin creates significant ecological damage and economic transformation with indigenous displacement.",
    keywords: ["congo", "mining", "biodiversity", "gorilla", "habitat loss"],
  },
  {
    name: "Southeast Asian Monsoon Flooding",
    slug: "southeast-asian-monsoon-flooding",
    category: "climate",
    region: "Southeast Asia",
    // Health + Econ driven SIGNIFICANT
    healthScore: 65, healthLevel: "SIGNIFICANT" as const,
    healthReasoning: "Unprecedented monsoon flooding displaces 2 million people across Myanmar, Thailand, and Vietnam. Waterborne disease outbreaks including cholera and dengue fever spiking. Access to clean water and medical facilities severely limited in affected regions.",
    ecoScore: 42, ecoLevel: "MODERATE" as const,
    ecoReasoning: "Floodwaters cause localized ecosystem disruption and agricultural land contamination. Rice paddies flooded before harvest. Mangrove degradation from saltwater intrusion. Recovery expected within one growing season for most areas.",
    econScore: 72, econLevel: "SIGNIFICANT" as const,
    econReasoning: "Rice crop losses estimated at $3B across three countries. Infrastructure damage includes 500+ destroyed bridges and 2,000km of roads. Tourism sector halted. Remittances from affected workers disrupted.",
    overallSummary: "Catastrophic monsoon flooding displaces millions across Southeast Asia with severe health and economic impacts.",
    keywords: ["flooding", "monsoon", "southeast asia", "displacement", "disaster"],
  },
  {
    name: "Arctic Sea Ice Extent Minimum",
    slug: "arctic-sea-ice-extent-minimum",
    category: "climate",
    region: "Arctic",
    // Eco-driven SIGNIFICANT (low health impact)
    healthScore: 18, healthLevel: "MINIMAL" as const,
    healthReasoning: "Arctic communities face cultural disruption from changing ice patterns affecting traditional hunting. Mental health concerns documented among indigenous peoples. No direct mass health impacts reported.",
    ecoScore: 82, ecoLevel: "SEVERE" as const,
    ecoReasoning: "Arctic sea ice extent reaches lowest recorded February measurement, accelerating albedo feedback loop. Polar bear populations declining 20% in southern range. Unprecedented methane release from permafrost thaw documented. Ecosystem collapse threshold approaching.",
    econScore: 42, econLevel: "MODERATE" as const,
    econReasoning: "Shipping routes opening create new economic opportunities worth $200B annually. Fishing industry displaced as species migrate. Indigenous subsistence economies disrupted. Oil and gas exploration accelerates in newly accessible regions.",
    overallSummary: "Record-low Arctic sea ice extent accelerates climate feedback loops and threatens polar ecosystem collapse.",
    keywords: ["arctic", "sea ice", "melting", "climate change", "permafrost"],
  },

  // MODERATE overall (moderate urgency)
  {
    name: "Plastic Ocean Microplastic Concentration",
    slug: "plastic-ocean-microplastic-concentration",
    category: "pollution",
    region: "Global",
    // Eco-driven MODERATE
    healthScore: 30, healthLevel: "MODERATE" as const,
    healthReasoning: "Microplastics detected in seafood and drinking water samples. Long-term human health effects uncertain but preliminary studies link exposure to inflammation markers. No acute health crisis documented.",
    ecoScore: 58, ecoLevel: "SIGNIFICANT" as const,
    ecoReasoning: "New research identifies microplastic concentration increases in all major ocean basins. Marine species showing bioaccumulation patterns. Plankton ingestion rates doubling in 10 years. Effects on food web documented but ecosystem-wide collapse not yet observed.",
    econScore: 28, econLevel: "MODERATE" as const,
    econReasoning: "Seafood industry faces consumer confidence decline. Cleanup technologies remain economically unviable at scale. Tourism sectors in heavily polluted areas report 10% revenue decline.",
    overallSummary: "Global ocean microplastic pollution intensifies with documented bioaccumulation in marine food webs.",
    keywords: ["plastic", "ocean", "microplastic", "pollution", "marine debris"],
  },
  {
    name: "European Winter Heat Anomaly",
    slug: "european-winter-heat-anomaly",
    category: "climate",
    region: "Europe",
    // All MODERATE (balanced)
    healthScore: 38, healthLevel: "MODERATE" as const,
    healthReasoning: "Unseasonably warm temperatures disrupt respiratory illness patterns, with flu season delayed. Allergy sufferers experience extended pollen exposure. Heat-related stress among vulnerable populations documented in southern Europe.",
    ecoScore: 48, ecoLevel: "MODERATE" as const,
    ecoReasoning: "Winter heat anomalies disrupt hibernation patterns for alpine species. Early spring blooming creates phenological mismatches. Ski resort ecosystems stressed. No evidence of mass extinction or ecosystem collapse.",
    econScore: 35, econLevel: "MODERATE" as const,
    econReasoning: "Ski industry reports $800M losses from shortened season. Energy costs reduced due to lower heating demand. Agricultural sector concerned about drought risk for upcoming summer. Wine industry disrupted by early budding.",
    overallSummary: "Record winter temperatures across Europe disrupt ecosystems and winter tourism economy.",
    keywords: ["heat wave", "europe", "temperature", "climate", "winter"],
  },
  {
    name: "Ganges River Industrial Pollution",
    slug: "ganges-river-industrial-pollution",
    category: "water",
    region: "South Asia",
    // All MODERATE
    healthScore: 48, healthLevel: "MODERATE" as const,
    healthReasoning: "Waterborne diseases including cholera and typhoid persist in downstream communities. Heavy metal contamination detected in fish samples. Cleanup efforts show progress but industrial discharge continues to impact 50 million people's water access.",
    ecoScore: 38, ecoLevel: "MODERATE" as const,
    ecoReasoning: "River dolphin populations stabilized after conservation efforts. Aquatic biodiversity remains degraded but no species extinctions documented. Riparian ecosystems show resilience in protected zones.",
    econScore: 30, econLevel: "MODERATE" as const,
    econReasoning: "Fishing industry constrained by pollution warnings. Tourism sector affected by water quality concerns. Textile industry cleanup costs rising. Government spending $500M annually on remediation.",
    overallSummary: "Ganges River pollution persists despite cleanup efforts, affecting millions' water access and public health.",
    keywords: ["ganges", "river", "water pollution", "india", "industrial"],
  },
  {
    name: "Pacific Garbage Patch Expansion",
    slug: "pacific-garbage-patch-expansion",
    category: "waste",
    region: "Pacific Ocean",
    // Eco-driven MODERATE
    healthScore: 26, healthLevel: "MODERATE" as const,
    healthReasoning: "Microplastic ingestion documented in seafood supply chains. Long-term health effects unknown. Coastal communities report declining fish catch quality. No acute health crisis.",
    ecoScore: 52, ecoLevel: "SIGNIFICANT" as const,
    ecoReasoning: "Great Pacific Garbage Patch estimated at 1.6M km² and growing 8% annually despite cleanup efforts. Seabird entanglement rates increasing. Plastic-to-plankton ratios reaching concerning levels in North Pacific gyre.",
    econScore: 28, econLevel: "MODERATE" as const,
    econReasoning: "Cleanup efforts cost $50M annually with limited effectiveness. Fishing industry reports gear loss and contamination. Tourism negligibly affected due to remote location.",
    overallSummary: "Pacific Garbage Patch continues expanding despite cleanup initiatives, threatening marine ecosystems.",
    keywords: ["garbage patch", "pacific", "waste", "ocean cleanup", "plastic"],
  },

  // MINIMAL overall (informational urgency)
  {
    name: "Global Renewable Energy Capacity Growth",
    slug: "global-renewable-energy-capacity-growth",
    category: "energy",
    region: "Global",
    // All MINIMAL (positive news)
    healthScore: 8, healthLevel: "MINIMAL" as const,
    healthReasoning: "Reduced air pollution from coal plant closures shows negligible immediate health benefits. Long-term air quality improvements expected but not yet measurable. No direct health impacts from renewable installations.",
    ecoScore: 12, ecoLevel: "MINIMAL" as const,
    ecoReasoning: "Renewable energy expansion reduces future emissions but no immediate ecosystem impact. Solar farm land use minimal. Wind turbine bird mortality remains localized concern. Net positive trajectory for emissions reduction.",
    econScore: 18, econLevel: "MINIMAL" as const,
    econReasoning: "Global renewable energy capacity grew 15% year-over-year. Solar manufacturing creates 500,000 jobs globally. Some coal sector job losses offset by clean energy employment. Investment reaches $500B annually.",
    overallSummary: "Global renewable energy capacity surges 15% annually, accelerating clean energy transition with job creation.",
    keywords: ["renewable", "solar", "wind", "energy transition", "clean energy"],
  },

  // INSUFFICIENT_DATA example
  {
    name: "Deep Sea Mining Exploration Permits",
    slug: "deep-sea-mining-exploration-permits",
    category: "ocean",
    region: "Global",
    // Economic dimension has INSUFFICIENT_DATA
    healthScore: 32, healthLevel: "MODERATE" as const,
    healthReasoning: "Potential seafood contamination from sediment plumes raises concerns. No direct human health data available. Indigenous Pacific communities express health concerns about disrupted fishing grounds.",
    ecoScore: 68, ecoLevel: "SIGNIFICANT" as const,
    ecoReasoning: "Deep sea mining threatens unexplored ecosystems including hydrothermal vent communities. Sediment plumes could impact midwater species. Scientists warn of irreversible biodiversity loss in abyssal zones before ecosystems are even catalogued.",
    econScore: -1, econLevel: "INSUFFICIENT_DATA" as const, // INSUFFICIENT_DATA
    econReasoning: null, // No economic reasoning available
    overallSummary: "Deep sea mining exploration raises ecological alarms with insufficient data on economic impacts.",
    keywords: ["deep sea mining", "ocean", "biodiversity", "exploration", "minerals"],
  },
];

// ─────────────────────────────────────────────────────────────────
// MAIN SEED FUNCTION
// ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== EcoTicker Seed Script v2 ===");
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Clear existing data (in correct FK order)
  console.log("[1/5] Clearing existing data...");
  await db.delete(topicKeywords);
  await db.delete(scoreHistory);
  await db.delete(articles);
  await db.delete(topics);
  console.log("✓ Database cleared\n");

  // Insert topics
  console.log("[2/5] Inserting topics...");
  for (const t of seedTopics) {
    const overallScore = computeOverallScore(t.healthScore, t.ecoScore, t.econScore);
    const urgency = deriveUrgency(overallScore);

    await db.insert(topics).values({
      name: t.name,
      slug: t.slug,
      category: t.category,
      region: t.region,
      currentScore: overallScore,
      previousScore: overallScore - 5, // Slight historical variance
      healthScore: t.healthScore,
      ecoScore: t.ecoScore,
      econScore: t.econScore,
      scoreReasoning: t.overallSummary,
      urgency,
      impactSummary: t.overallSummary,
      imageUrl: null,
      articleCount: 3,
    });

    console.log(`  ✓ ${t.name} (overall=${overallScore}, urgency=${urgency})`);
  }
  console.log(`✓ Inserted ${seedTopics.length} topics\n`);

  // Insert articles (3 per topic)
  console.log("[3/5] Inserting articles...");
  const sources = ["Reuters", "BBC News", "The Guardian", "Associated Press", "Al Jazeera"];
  const articleTitles = [
    "Latest developments reported",
    "Expert analysis and concerns",
    "Government response and policy updates",
  ];

  let articleCount = 0;
  for (const t of seedTopics) {
    const topicRow = await db.select({ id: topics.id }).from(topics).where(eq(topics.slug, t.slug)).limit(1);
    if (!topicRow[0]) continue;
    const topicId = topicRow[0].id;

    for (let i = 0; i < 3; i++) {
      const daysAgo = Math.floor(Math.random() * 5);
      const publishedAt = new Date(Date.now() - daysAgo * 86400000);

      await db.insert(articles).values({
        topicId,
        title: `${t.name}: ${articleTitles[i]}`,
        url: `https://example.com/articles/${t.slug}-${i + 1}`,
        source: sources[Math.floor(Math.random() * sources.length)],
        summary: t.overallSummary,
        imageUrl: null,
        publishedAt,
      });
      articleCount++;
    }
  }
  console.log(`✓ Inserted ${articleCount} articles\n`);

  // Insert score history (7 days per topic)
  console.log("[4/5] Inserting score history...");
  let historyCount = 0;

  for (const t of seedTopics) {
    const topicRow = await db.select({ id: topics.id }).from(topics).where(eq(topics.slug, t.slug)).limit(1);
    if (!topicRow[0]) continue;
    const topicId = topicRow[0].id;

    // Generate 7 days of history with slight variance
    for (let day = 6; day >= 0; day--) {
      const recordedAt = new Date(Date.now() - day * 86400000).toISOString().split("T")[0];

      // Add slight variance (±10 points) but stay within same level mostly
      const healthVariance = Math.floor(Math.random() * 20) - 10;
      const ecoVariance = Math.floor(Math.random() * 20) - 10;
      const econVariance = Math.floor(Math.random() * 20) - 10;

      const dayHealthScore = t.healthScore >= 0 ? Math.max(0, Math.min(100, t.healthScore + healthVariance)) : -1;
      const dayEcoScore = t.ecoScore >= 0 ? Math.max(0, Math.min(100, t.ecoScore + ecoVariance)) : -1;
      const dayEconScore = t.econScore >= 0 ? Math.max(0, Math.min(100, t.econScore + econVariance)) : -1;

      const dayOverallScore = computeOverallScore(dayHealthScore, dayEcoScore, dayEconScore);

      const healthLevel = dayHealthScore >= 0 ? scoreToLevel(dayHealthScore) : "INSUFFICIENT_DATA";
      const ecoLevel = dayEcoScore >= 0 ? scoreToLevel(dayEcoScore) : "INSUFFICIENT_DATA";
      const econLevel = dayEconScore >= 0 ? scoreToLevel(dayEconScore) : "INSUFFICIENT_DATA";

      // Abbreviated reasoning for history (not full reasoning like current)
      const abbreviatedSummary = t.overallSummary.slice(0, 100) + "...";

      await db.insert(scoreHistory).values({
        topicId,
        score: dayOverallScore,
        healthScore: dayHealthScore >= 0 ? dayHealthScore : null,
        ecoScore: dayEcoScore >= 0 ? dayEcoScore : null,
        econScore: dayEconScore >= 0 ? dayEconScore : null,
        healthLevel: healthLevel,
        ecoLevel: ecoLevel,
        econLevel: econLevel,
        healthReasoning: dayHealthScore >= 0 ? t.healthReasoning.slice(0, 150) : null,
        ecoReasoning: dayEcoScore >= 0 ? t.ecoReasoning.slice(0, 150) : null,
        econReasoning: dayEconScore >= 0 && t.econReasoning ? t.econReasoning.slice(0, 150) : null,
        overallSummary: abbreviatedSummary,
        impactSummary: abbreviatedSummary,
        rawLlmResponse: null, // Seed data doesn't have LLM responses
        anomalyDetected: false,
        recordedAt,
      });
      historyCount++;
    }
  }
  console.log(`✓ Inserted ${historyCount} score history entries\n`);

  // Insert keywords
  console.log("[5/5] Inserting keywords...");
  let keywordCount = 0;
  for (const t of seedTopics) {
    const topicRow = await db.select({ id: topics.id }).from(topics).where(eq(topics.slug, t.slug)).limit(1);
    if (!topicRow[0]) continue;
    const topicId = topicRow[0].id;

    for (const kw of t.keywords) {
      await db.insert(topicKeywords).values({
        topicId,
        keyword: kw.toLowerCase(),
      }).onConflictDoNothing();
      keywordCount++;
    }
  }
  console.log(`✓ Inserted ${keywordCount} keywords\n`);

  // Summary
  console.log("=== Seed Complete ===");
  console.log(`Topics: ${seedTopics.length}`);
  console.log(`Articles: ${articleCount}`);
  console.log(`Score history: ${historyCount}`);
  console.log(`Keywords: ${keywordCount}`);
  console.log("\n✓ All severity levels represented");
  console.log("✓ INSUFFICIENT_DATA example included (Deep Sea Mining - econ dimension)");
  console.log("✓ Realistic reasoning text based on real-world scenarios");

  await pool.end();
}

// ─────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
