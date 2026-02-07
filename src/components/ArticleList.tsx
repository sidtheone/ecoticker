import type { Article } from "@/lib/types";

export default function ArticleList({ articles }: { articles: Article[] }) {
  if (articles.length === 0) {
    return <div data-testid="articles-empty" className="text-gray-500 text-sm">No articles yet</div>;
  }

  return (
    <div data-testid="article-list">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Related Articles ({articles.length})
      </h3>
      <div className="space-y-3">
        {articles.map((a) => (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-gray-900 border border-gray-800 rounded-lg p-3 hover:border-gray-600 transition-colors"
            data-testid="article-item"
          >
            <div className="text-sm font-medium text-gray-200">{a.title}</div>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              {a.source && <span>{a.source}</span>}
              {a.publishedAt && (
                <span>{new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              )}
            </div>
            {a.summary && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{a.summary}</p>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
