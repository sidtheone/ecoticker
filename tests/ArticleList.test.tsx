import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ArticleList from "@/components/ArticleList";
import type { Article } from "@/lib/types";

const mockArticles: Article[] = [
  { id: 1, topicId: 1, title: "Ice caps shrinking", url: "https://example.com/1", source: "Reuters", summary: "Arctic ice declining fast", imageUrl: null, publishedAt: "2026-02-05T10:00:00Z", sourceType: "news" },
  { id: 2, topicId: 1, title: "Record temperatures", url: "https://example.com/2", source: null, summary: null, imageUrl: null, publishedAt: null, sourceType: "news" },
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
    expect(screen.getByText("Reuters")).toBeInTheDocument();
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
