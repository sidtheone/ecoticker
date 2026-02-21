import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ArticleList from "@/components/ArticleList";
import type { Article } from "@/lib/types";

const mockArticles: Article[] = [
  { id: 1, topicId: 1, title: "Ice caps shrinking", url: "https://example.com/1", source: "Reuters", summary: "Arctic ice declining fast", imageUrl: null, publishedAt: "2026-02-05T10:00:00Z", sourceType: "gnews" },
  { id: 2, topicId: 1, title: "Record temperatures", url: "https://example.com/2", source: null, summary: null, imageUrl: null, publishedAt: null, sourceType: "gnews" },
];

describe("ArticleList", () => {
  test("renders article count in heading", () => {
    render(<ArticleList articles={mockArticles} />);
    expect(screen.getByText("Related Articles (2)")).toBeInTheDocument();
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

describe("source attribution badge", () => {
  test("renders GNews badge for sourceType gnews", () => {
    const articles: Article[] = [
      { id: 1, topicId: 1, title: "Test article", url: "https://example.com/1", source: "Reuters", summary: null, imageUrl: null, publishedAt: null, sourceType: "gnews" },
    ];
    render(<ArticleList articles={articles} />);
    expect(screen.getByText("GNews", { exact: false })).toBeInTheDocument();
  });

  test("renders RSS badge for sourceType rss", () => {
    const articles: Article[] = [
      { id: 1, topicId: 1, title: "Test article", url: "https://example.com/1", source: "The Guardian", summary: null, imageUrl: null, publishedAt: null, sourceType: "rss" },
    ];
    render(<ArticleList articles={articles} />);
    expect(screen.getByText("RSS", { exact: false })).toBeInTheDocument();
  });

  test("renders source name only when sourceType is null", () => {
    const articles: Article[] = [
      { id: 1, topicId: 1, title: "Test article", url: "https://example.com/1", source: "Reuters", summary: null, imageUrl: null, publishedAt: null, sourceType: null },
    ];
    render(<ArticleList articles={articles} />);
    expect(screen.getByText("Reuters")).toBeInTheDocument();
    expect(screen.queryByText("GNews", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText("RSS", { exact: false })).not.toBeInTheDocument();
  });

  test("renders source name only when sourceType is empty string", () => {
    const articles: Article[] = [
      { id: 1, topicId: 1, title: "Test article", url: "https://example.com/1", source: "Reuters", summary: null, imageUrl: null, publishedAt: null, sourceType: "" },
    ];
    render(<ArticleList articles={articles} />);
    expect(screen.getByText("Reuters")).toBeInTheDocument();
    expect(screen.queryByText("GNews", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText("RSS", { exact: false })).not.toBeInTheDocument();
  });

  test("renders GNews for any non-rss sourceType", () => {
    const articles: Article[] = [
      { id: 1, topicId: 1, title: "Test article", url: "https://example.com/1", source: "Reuters", summary: null, imageUrl: null, publishedAt: null, sourceType: "api" },
    ];
    render(<ArticleList articles={articles} />);
    expect(screen.getByText("GNews", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("RSS", { exact: false })).not.toBeInTheDocument();
  });

  test("renders nothing when source is null but sourceType exists", () => {
    const articles: Article[] = [
      { id: 1, topicId: 1, title: "Test article", url: "https://example.com/1", source: null, summary: null, imageUrl: null, publishedAt: null, sourceType: "rss" },
    ];
    render(<ArticleList articles={articles} />);
    expect(screen.queryByText("RSS", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText("GNews", { exact: false })).not.toBeInTheDocument();
  });
});
