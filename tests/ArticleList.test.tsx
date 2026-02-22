import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ArticleList from "@/components/ArticleList";
import type { Article } from "@/lib/types";

const mockArticles: Article[] = [
  { id: 1, topicId: 1, title: "Ice caps shrinking", url: "https://example.com/1", source: "Reuters", summary: "Arctic ice declining fast", imageUrl: null, publishedAt: "2026-02-05T10:00:00Z", sourceType: "gnews" },
  { id: 2, topicId: 1, title: "Record temperatures", url: "https://example.com/2", source: null, summary: null, imageUrl: null, publishedAt: null, sourceType: "gnews" },
];

describe("ArticleList", () => {
  test("renders article items without a standalone heading (parent section owns the heading)", () => {
    render(<ArticleList articles={mockArticles} />);
    expect(screen.getByTestId("article-list")).toBeInTheDocument();
    expect(screen.queryByText(/Related Articles/)).not.toBeInTheDocument();
  });

  test("renders all article items", () => {
    render(<ArticleList articles={mockArticles} />);
    const items = screen.getAllByTestId("article-item");
    expect(items).toHaveLength(2);
  });

  test("renders article titles", () => {
    render(<ArticleList articles={mockArticles} />);
    expect(screen.getByText("Ice caps shrinking")).toBeInTheDocument();
    expect(screen.getByText("Record temperatures")).toBeInTheDocument();
  });

  test("renders source when available", () => {
    render(<ArticleList articles={mockArticles} />);
    expect(screen.getByText("Reuters", { exact: false })).toBeInTheDocument();
  });

  test("renders summary when available", () => {
    render(<ArticleList articles={mockArticles} />);
    expect(screen.getByText("Arctic ice declining fast")).toBeInTheDocument();
  });

  test("links open in new tab", () => {
    render(<ArticleList articles={mockArticles} />);
    const items = screen.getAllByTestId("article-item");
    expect(items[0].getAttribute("href")).toBe("https://example.com/1");
    expect(items[0].getAttribute("target")).toBe("_blank");
  });

  test("shows empty state when no articles", () => {
    render(<ArticleList articles={[]} />);
    expect(screen.getByTestId("articles-empty")).toBeInTheDocument();
  });
});

// ─── AC6 (Story 8-2): Badge only renders for rss and gnews ──────────────────
// Badge guard: a.sourceType === "rss" || a.sourceType === "gnews"

describe("source attribution badge", () => {
  test('sourceType "gnews" renders "GNews" badge', () => {
    const articles: Article[] = [
      { id: 1, topicId: 1, title: "Test article", url: "https://example.com/1", source: "Reuters", summary: null, imageUrl: null, publishedAt: null, sourceType: "gnews" },
    ];
    render(<ArticleList articles={articles} />);
    expect(screen.getByText("GNews", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("RSS", { exact: false })).not.toBeInTheDocument();
  });

  test('sourceType "rss" renders "RSS" badge', () => {
    const articles: Article[] = [
      { id: 1, topicId: 1, title: "Test article", url: "https://example.com/1", source: "The Guardian", summary: null, imageUrl: null, publishedAt: null, sourceType: "rss" },
    ];
    render(<ArticleList articles={articles} />);
    expect(screen.getByText("RSS", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("GNews", { exact: false })).not.toBeInTheDocument();
  });

  test("renders source name only when sourceType is null (no badge)", () => {
    const articles: Article[] = [
      { id: 1, topicId: 1, title: "Test article", url: "https://example.com/1", source: "Reuters", summary: null, imageUrl: null, publishedAt: null, sourceType: null },
    ];
    render(<ArticleList articles={articles} />);
    expect(screen.getByText("Reuters")).toBeInTheDocument();
    expect(screen.queryByText("GNews", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText("RSS", { exact: false })).not.toBeInTheDocument();
  });

  test("renders source name only when sourceType is empty string (no badge)", () => {
    const articles: Article[] = [
      { id: 1, topicId: 1, title: "Test article", url: "https://example.com/1", source: "Reuters", summary: null, imageUrl: null, publishedAt: null, sourceType: "" },
    ];
    render(<ArticleList articles={articles} />);
    expect(screen.getByText("Reuters")).toBeInTheDocument();
    expect(screen.queryByText("GNews", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText("RSS", { exact: false })).not.toBeInTheDocument();
  });

  test('sourceType "api" renders NO badge', () => {
    const articles: Article[] = [
      { id: 1, topicId: 1, title: "Test article", url: "https://example.com/1", source: "Reuters", summary: null, imageUrl: null, publishedAt: null, sourceType: "api" },
    ];
    render(<ArticleList articles={articles} />);
    expect(screen.queryByText("GNews", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText("RSS", { exact: false })).not.toBeInTheDocument();
  });

  test('sourceType "unknown" renders NO badge', () => {
    const articles: Article[] = [
      { id: 1, topicId: 1, title: "Test article", url: "https://example.com/1", source: "Reuters", summary: null, imageUrl: null, publishedAt: null, sourceType: "unknown" },
    ];
    render(<ArticleList articles={articles} />);
    expect(screen.queryByText("GNews", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText("RSS", { exact: false })).not.toBeInTheDocument();
  });

  test('sourceType "seed" renders NO badge', () => {
    const articles: Article[] = [
      { id: 1, topicId: 1, title: "Test article", url: "https://example.com/1", source: "Reuters", summary: null, imageUrl: null, publishedAt: null, sourceType: "seed" },
    ];
    render(<ArticleList articles={articles} />);
    expect(screen.queryByText("GNews", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText("RSS", { exact: false })).not.toBeInTheDocument();
  });

  test("renders no badge when source is null but sourceType exists", () => {
    const articles: Article[] = [
      { id: 1, topicId: 1, title: "Test article", url: "https://example.com/1", source: null, summary: null, imageUrl: null, publishedAt: null, sourceType: "rss" },
    ];
    render(<ArticleList articles={articles} />);
    expect(screen.queryByText("RSS", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText("GNews", { exact: false })).not.toBeInTheDocument();
  });
});
