import type { Article } from "@/lib/types";

export default function ArticleList({ articles }: { articles: Article[] }) {
  if (articles.length === 0) {
    return <div data-testid="articles-empty" className="text-gray-500 text-sm">No sources yet</div>;
  }

  return (
    <div data-testid="article-list">
      <div className="flex flex-col gap-1">
        {articles.map((a) => (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 px-3 py-2 rounded-md bg-stone-50 dark:bg-gray-900 border border-stone-200 dark:border-gray-800"
            data-testid="article-item"
          >
            <div className="flex-1 min-w-0">
              <div className="flex-1 text-sm font-medium text-stone-700 dark:text-gray-200 truncate">{a.title}</div>
              <div className="flex items-center gap-2 mt-1 text-xs text-stone-500 dark:text-gray-400 shrink-0">
                {a.source && (
                  <span>
                    {a.source}
                    {(a.sourceType === "rss" || a.sourceType === "gnews") && (
                      <span className="text-stone-400 dark:text-stone-500">
                        {" · "}{a.sourceType === "rss" ? "RSS" : "GNews"}
                      </span>
                    )}
                  </span>
                )}
                <span>
                  {a.publishedAt
                    ? new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "Date unknown"}
                </span>
              </div>
              {a.summary && (
                <p className="text-xs text-stone-400 line-clamp-1 mt-1">{a.summary}</p>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
