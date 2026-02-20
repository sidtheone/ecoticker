import Link from "next/link";

export default function Footer() {
  return (
    <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 mt-8 border-t border-stone-200 dark:border-gray-800" data-testid="footer">
      <div className="flex flex-wrap gap-4 text-sm text-stone-500 dark:text-gray-400">
        <Link href="/scoring" className="hover:text-stone-700 dark:hover:text-gray-200">
          Scoring Methodology
        </Link>
        <Link href="/data-policy" className="hover:text-stone-700 dark:hover:text-gray-200">
          Data Policy
        </Link>
      </div>
      <p className="mt-2 text-xs text-stone-400 dark:text-gray-500">
        &copy; {new Date().getFullYear()} EcoTicker
      </p>
    </footer>
  );
}
