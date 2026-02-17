import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data Policy — EcoTicker",
  description:
    "What data EcoTicker collects, how it's used, and your rights under GDPR.",
};

export default function DataPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto" data-testid="data-policy-page">
      <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
        ← Back to Dashboard
      </Link>

      <h1 className="text-2xl font-bold text-stone-800 dark:text-white mt-6 mb-8">
        Data Policy
      </h1>

      {/* Section 1: What We Collect */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-700 dark:text-gray-200 mb-3">
          What We Collect
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-stone-200 dark:border-gray-700">
            <thead>
              <tr className="bg-stone-100 dark:bg-gray-800">
                <th className="text-left p-2 border-b border-stone-200 dark:border-gray-700">Data</th>
                <th className="text-left p-2 border-b border-stone-200 dark:border-gray-700">Where</th>
                <th className="text-left p-2 border-b border-stone-200 dark:border-gray-700">Why</th>
                <th className="text-left p-2 border-b border-stone-200 dark:border-gray-700">Retained</th>
              </tr>
            </thead>
            <tbody className="text-stone-600 dark:text-gray-300">
              <tr>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Truncated IP addresses</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Audit logs</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Abuse prevention</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">90 days</td>
              </tr>
              <tr>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Page view counts</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Topic analytics</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Understanding which topics matter</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Indefinite (no PII)</td>
              </tr>
              <tr>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Feedback text</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Score feedback form</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Improving scoring accuracy</td>
                <td className="p-2 border-b border-stone-100 dark:border-gray-800">Indefinite (no PII)</td>
              </tr>
              <tr>
                <td className="p-2">Theme preference</td>
                <td className="p-2">Your browser (localStorage)</td>
                <td className="p-2">Remembering light/dark mode</td>
                <td className="p-2">Until you clear browser data</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 2: What We Don't Collect */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-700 dark:text-gray-200 mb-3">
          What We Don&apos;t Collect
        </h2>
        <ul className="text-sm text-stone-600 dark:text-gray-300 space-y-1.5 list-disc list-inside">
          <li>No cookies</li>
          <li>No user accounts or email addresses</li>
          <li>No tracking pixels or analytics scripts</li>
          <li>No browser fingerprinting</li>
          <li>No data sold to third parties</li>
          <li>No third-party advertising</li>
        </ul>
      </section>

      {/* Section 3: Legal Basis */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-700 dark:text-gray-200 mb-3">
          Legal Basis
        </h2>
        <p className="text-sm text-stone-600 dark:text-gray-300">
          We process truncated IP addresses under legitimate interest (GDPR Article 6(1)(f)) for the purpose of abuse prevention. The last octet of every IP address is removed before storage, meaning we never store a complete IP address. While truncated IPs are generally not considered personal data by most Data Protection Authorities, we apply GDPR protections regardless.
        </p>
      </section>

      {/* Section 4: Your Rights */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-700 dark:text-gray-200 mb-3">
          Your Rights
        </h2>
        <p className="text-sm text-stone-600 dark:text-gray-300 mb-2">
          Under GDPR Articles 15, 17, and 21, you have the right to:
        </p>
        <ul className="text-sm text-stone-600 dark:text-gray-300 space-y-1.5 list-disc list-inside">
          <li><strong>Access</strong> — Request a copy of any data associated with your (truncated) IP address</li>
          <li><strong>Deletion</strong> — Request deletion of audit log entries associated with your IP</li>
          <li><strong>Object</strong> — Object to the processing of your data for abuse prevention</li>
        </ul>
        <p className="text-sm text-stone-500 dark:text-gray-400 mt-2">
          To exercise these rights, contact us at <strong>privacy@ecoticker.eu</strong>.
        </p>
      </section>

      {/* Section 5: Data Retention */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-700 dark:text-gray-200 mb-3">
          Data Retention
        </h2>
        <ul className="text-sm text-stone-600 dark:text-gray-300 space-y-1.5 list-disc list-inside">
          <li><strong>Audit logs</strong> (containing truncated IPs) are automatically purged after 90 days</li>
          <li><strong>Aggregated analytics</strong> (page view counts, topic scores) contain no personal data and are retained indefinitely</li>
          <li><strong>Theme preference</strong> is stored only in your browser&apos;s localStorage and is never sent to our servers</li>
        </ul>
      </section>

      {/* Section 6: Data Controller */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-700 dark:text-gray-200 mb-3">
          Data Controller
        </h2>
        <p className="text-sm text-stone-600 dark:text-gray-300">
          EcoTicker is operated by Sidharth Arora. For data protection inquiries, contact <strong>privacy@ecoticker.eu</strong>.
        </p>
      </section>

      {/* Section 7: Changes to This Policy */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-stone-700 dark:text-gray-200 mb-3">
          Changes to This Policy
        </h2>
        <p className="text-sm text-stone-600 dark:text-gray-300">
          Any changes to this policy will be posted on this page with an updated date. We will not reduce your rights under this policy without your explicit consent.
        </p>
        <p className="text-sm text-stone-400 dark:text-gray-500 mt-2" data-testid="last-updated">
          Last updated: February 13, 2026
        </p>
      </section>
    </div>
  );
}
