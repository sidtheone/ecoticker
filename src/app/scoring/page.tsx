import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Scoring Methodology — EcoTicker",
  description:
    "How EcoTicker calculates environmental impact severity scores using a 4-level rubric across ecological, health, and economic dimensions.",
  openGraph: {
    title: "Scoring Methodology — EcoTicker",
    description: "How EcoTicker calculates environmental impact severity scores.",
  },
};

export default function ScoringPage() {
  return (
    <div className="max-w-3xl mx-auto" data-testid="scoring-page">
      <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
        ← Back to Dashboard
      </Link>

      <h1 className="text-2xl font-bold text-stone-800 dark:text-white mt-6 mb-8">
        Scoring Methodology
      </h1>

      {/* Section 1: The 4-Level Severity Scale */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-700 dark:text-gray-200 mb-3">
          The 4-Level Severity Scale
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-stone-200 dark:border-gray-700">
            <thead>
              <tr className="bg-stone-100 dark:bg-gray-800">
                <th className="text-left p-2 border-b border-stone-200 dark:border-gray-700">Level</th>
                <th className="text-left p-2 border-b border-stone-200 dark:border-gray-700">Score</th>
                <th className="text-left p-2 border-b border-stone-200 dark:border-gray-700">Criteria</th>
                <th className="text-left p-2 border-b border-stone-200 dark:border-gray-700">Example</th>
              </tr>
            </thead>
            <tbody className="text-stone-600 dark:text-gray-300">
              <tr>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800 font-bold text-red-500">SEVERE</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">76–100</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Irreversible or catastrophic environmental damage</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Major oil spill, species extinction event</td>
              </tr>
              <tr>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800 font-bold text-orange-500">SIGNIFICANT</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">51–75</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Serious damage requiring years of recovery</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Large-scale deforestation, coral bleaching event</td>
              </tr>
              <tr>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800 font-bold text-yellow-500">MODERATE</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">26–50</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Notable impact with recovery possible in months</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Localized pollution incident, habitat fragmentation</td>
              </tr>
              <tr>
                <td className="p-2 font-bold text-green-500">MINIMAL</td>
                <td className="p-2">0–25</td>
                <td className="p-2">Minor or localized impact, easily reversible</td>
                <td className="p-2">Small chemical spill contained quickly</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 2: Three Dimensions */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-700 dark:text-gray-200 mb-3">
          Three Dimensions
        </h2>
        <p className="text-sm text-stone-600 dark:text-gray-300 mb-3">
          Each topic is scored across three dimensions, weighted by their relative importance:
        </p>
        <div className="space-y-3">
          <div className="bg-[#f5f0e8] dark:bg-gray-900 border border-[#e8dfd3] dark:border-gray-800 rounded-lg p-4">
            <h3 className="font-semibold text-stone-700 dark:text-gray-200">Ecological Impact <span className="text-sm font-normal text-stone-400">(40% weight)</span></h3>
            <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">Damage to ecosystems, biodiversity, and natural resources. Considers scale, reversibility, and cascading effects.</p>
          </div>
          <div className="bg-[#f5f0e8] dark:bg-gray-900 border border-[#e8dfd3] dark:border-gray-800 rounded-lg p-4">
            <h3 className="font-semibold text-stone-700 dark:text-gray-200">Health Impact <span className="text-sm font-normal text-stone-400">(35% weight)</span></h3>
            <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">Direct and indirect effects on human health. Includes air quality, water contamination, disease vectors, and long-term exposure risks.</p>
          </div>
          <div className="bg-[#f5f0e8] dark:bg-gray-900 border border-[#e8dfd3] dark:border-gray-800 rounded-lg p-4">
            <h3 className="font-semibold text-stone-700 dark:text-gray-200">Economic Impact <span className="text-sm font-normal text-stone-400">(25% weight)</span></h3>
            <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">Financial consequences including cleanup costs, lost productivity, supply chain disruptions, and long-term economic damage.</p>
          </div>
        </div>
      </section>

      {/* Section 3: Why These Weights */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-700 dark:text-gray-200 mb-3">
          Why These Weights
        </h2>
        <p className="text-sm text-stone-600 dark:text-gray-300">
          Ecological damage receives the highest weight (40%) because it is often the hardest to reverse — extinct species cannot be restored and destroyed ecosystems take decades to recover. Health impact (35%) reflects the direct human cost of environmental events. Economic impact (25%) captures downstream financial consequences, which are significant but typically more recoverable than ecological or health damage.
        </p>
      </section>

      {/* Section 4: How the Overall Score Works */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-700 dark:text-gray-200 mb-3">
          How the Overall Score Works
        </h2>
        <p className="text-sm text-stone-600 dark:text-gray-300 mb-3">
          The overall severity score is a weighted average of the three dimensions:
        </p>
        <div className="bg-[#f5f0e8] dark:bg-gray-900 border border-[#e8dfd3] dark:border-gray-800 rounded-lg p-4 font-mono text-sm text-stone-700 dark:text-gray-200">
          Score = (Eco × 0.40) + (Health × 0.35) + (Econ × 0.25)
        </div>
        <p className="text-sm text-stone-500 dark:text-gray-400 mt-2">
          Each dimension score ranges from 0 to 100. The resulting overall score also ranges from 0 to 100.
        </p>
      </section>

      {/* Section 5: Urgency Levels */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-700 dark:text-gray-200 mb-3">
          Urgency Levels
        </h2>
        <p className="text-sm text-stone-600 dark:text-gray-300 mb-3">
          The overall score maps to an urgency level displayed as a colored badge:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-stone-200 dark:border-gray-700">
            <thead>
              <tr className="bg-stone-100 dark:bg-gray-800">
                <th className="text-left p-2 border-b border-stone-200 dark:border-gray-700">Score Range</th>
                <th className="text-left p-2 border-b border-stone-200 dark:border-gray-700">Urgency</th>
                <th className="text-left p-2 border-b border-stone-200 dark:border-gray-700">Badge Color</th>
              </tr>
            </thead>
            <tbody className="text-stone-600 dark:text-gray-300">
              <tr>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">80–100</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800 font-bold text-red-500">Breaking</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Red</td>
              </tr>
              <tr>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">60–79</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800 font-bold text-orange-500">Critical</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Orange</td>
              </tr>
              <tr>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">30–59</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800 font-bold text-yellow-500">Moderate</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Yellow</td>
              </tr>
              <tr>
                <td className="p-2">0–29</td>
                <td className="p-2 font-bold text-green-500">Informational</td>
                <td className="p-2">Green</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 6: Data Sources */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-700 dark:text-gray-200 mb-3">
          Data Sources
        </h2>
        <p className="text-sm text-stone-600 dark:text-gray-300">
          Articles are collected daily from major news sources via the NewsAPI service. Each article is analyzed by a large language model (LLM) that classifies its environmental topic and scores the severity across all three dimensions. Scores are then aggregated at the topic level using the weighted formula above.
        </p>
      </section>

      {/* Section 7: Limitations */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-700 dark:text-gray-200 mb-3">
          Limitations
        </h2>
        <ul className="text-sm text-stone-600 dark:text-gray-300 space-y-2 list-disc list-inside">
          <li><strong>LLM accuracy:</strong> Scores are generated by AI models, which can occasionally misinterpret context, severity, or nuance in news articles.</li>
          <li><strong>News source bias:</strong> Coverage varies by region and topic. Events in underreported areas may receive fewer articles and less accurate scoring.</li>
          <li><strong>Scoring subjectivity:</strong> Environmental severity is inherently subjective. Our rubric provides a consistent framework, but reasonable people may disagree on specific scores.</li>
          <li><strong>Temporal lag:</strong> Articles are processed in daily batches. Rapidly evolving situations may not reflect the latest developments.</li>
        </ul>
      </section>
    </div>
  );
}
