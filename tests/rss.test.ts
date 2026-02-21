import Parser from "rss-parser";

jest.mock("rss-parser");

const mockParseURL = jest.fn();
(Parser as unknown as jest.Mock).mockImplementation(() => ({
  parseURL: mockParseURL,
}));

// Must import AFTER mocks are set up
import { fetchRssFeeds, NewsArticle } from "../scripts/rss";

beforeEach(() => {
  mockParseURL.mockReset();
});

describe("fetchRssFeeds", () => {
  it("parses RSS 2.0 feed successfully", async () => {
    mockParseURL.mockResolvedValueOnce({
      title: "Guardian Environment",
      items: [
        {
          title: "Climate report released",
          link: "https://example.com/article-1",
          isoDate: "2026-02-20T10:00:00Z",
          contentSnippet: "A new climate report was released today.",
          enclosure: { url: "https://example.com/image.jpg" },
        },
      ],
    });
    // Remaining feeds return empty
    for (let i = 1; i < 10; i++) mockParseURL.mockResolvedValueOnce({ title: `Feed ${i}`, items: [] });

    const articles = await fetchRssFeeds();

    expect(articles).toHaveLength(1);
    expect(articles[0]).toEqual<NewsArticle>({
      title: "Climate report released",
      url: "https://example.com/article-1",
      source: { name: "Guardian Environment" },
      description: "A new climate report was released today.",
      urlToImage: "https://example.com/image.jpg",
      publishedAt: "2026-02-20T10:00:00Z",
    });
  });

  it("falls back to content when contentSnippet is absent", async () => {
    mockParseURL.mockResolvedValueOnce({
      title: "Carbon Brief",
      items: [
        {
          title: "Emissions data update",
          link: "https://carbonbrief.org/emissions",
          isoDate: "2026-02-19T08:30:00Z",
          content: "<p>Full HTML content here</p>",
        },
      ],
    });
    for (let i = 1; i < 10; i++) mockParseURL.mockResolvedValueOnce({ title: `Feed ${i}`, items: [] });

    const articles = await fetchRssFeeds();

    expect(articles).toHaveLength(1);
    expect(articles[0].description).toBe("<p>Full HTML content here</p>");
    expect(articles[0].urlToImage).toBeNull();
    expect(articles[0].source).toEqual({ name: "Carbon Brief" });
  });

  it("uses pubDate as fallback when isoDate is absent", async () => {
    mockParseURL.mockResolvedValueOnce({
      title: "RSS 2.0 Feed",
      items: [
        {
          title: "Old format article",
          link: "https://example.com/old-format",
          pubDate: "Thu, 20 Feb 2026 10:00:00 GMT",
          contentSnippet: "Content here",
        },
      ],
    });
    for (let i = 1; i < 10; i++) mockParseURL.mockResolvedValueOnce({ title: `Feed ${i}`, items: [] });

    const articles = await fetchRssFeeds();

    expect(articles).toHaveLength(1);
    expect(articles[0].publishedAt).toBe("Thu, 20 Feb 2026 10:00:00 GMT");
  });

  it("handles timeout / network error gracefully", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    for (let i = 0; i < 10; i++) mockParseURL.mockRejectedValueOnce(new Error("Request timed out"));

    const articles = await fetchRssFeeds();

    expect(articles).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to fetch RSS feed"),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it("handles malformed XML gracefully", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    for (let i = 0; i < 10; i++) mockParseURL.mockRejectedValueOnce(new Error("Invalid XML"));

    const articles = await fetchRssFeeds();

    expect(articles).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("handles empty feed (0 items)", async () => {
    for (let i = 0; i < 10; i++) mockParseURL.mockResolvedValueOnce({ title: "Empty Feed", items: [] });

    const articles = await fetchRssFeeds();

    expect(articles).toEqual([]);
  });

  it("handles mixed success/failure across multiple feeds", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    // First call succeeds, second fails
    mockParseURL
      .mockResolvedValueOnce({
        title: "Good Feed",
        items: [
          {
            title: "Good article",
            link: "https://example.com/good",
            isoDate: "2026-02-20T12:00:00Z",
            contentSnippet: "Content",
          },
        ],
      })
      .mockRejectedValueOnce(new Error("Feed down"));

    // Repeat for remaining feeds (10 total default feeds)
    for (let i = 2; i < 10; i++) {
      mockParseURL.mockResolvedValueOnce({ title: `Feed ${i}`, items: [] });
    }

    const articles = await fetchRssFeeds();

    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe("Good article");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to fetch RSS feed"),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it("guards against undefined feed.title", async () => {
    mockParseURL.mockResolvedValueOnce({
      title: undefined,
      items: [
        {
          title: "Article from unknown feed",
          link: "https://example.com/unknown",
          isoDate: "2026-02-20T10:00:00Z",
        },
      ],
    });
    for (let i = 1; i < 10; i++) mockParseURL.mockResolvedValueOnce({ title: `Feed ${i}`, items: [] });

    const articles = await fetchRssFeeds();

    expect(articles[0].source).toEqual({ name: "Unknown" });
  });

  it("skips items without title, link, or publication date", async () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
    mockParseURL.mockResolvedValueOnce({
      title: "Test Feed",
      items: [
        { title: null, link: "https://example.com/no-title" },
        { title: "No link article", link: undefined },
        { title: "No date article", link: "https://example.com/no-date" }, // no isoDate or pubDate
        { title: "Valid", link: "https://example.com/valid", isoDate: "2026-02-20T10:00:00Z" },
      ],
    });
    for (let i = 1; i < 10; i++) mockParseURL.mockResolvedValueOnce({ title: `Feed ${i}`, items: [] });

    const articles = await fetchRssFeeds();

    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe("Valid");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Skipping article")
    );
    consoleSpy.mockRestore();
  });

  it("always returns source as { name: string }, never undefined", async () => {
    mockParseURL.mockResolvedValueOnce({
      title: "Named Feed",
      items: [
        {
          title: "Test",
          link: "https://example.com/test",
          isoDate: "2026-02-20T10:00:00Z",
        },
      ],
    });
    for (let i = 1; i < 10; i++) mockParseURL.mockResolvedValueOnce({ title: `Feed ${i}`, items: [] });

    const articles = await fetchRssFeeds();

    expect(articles[0].source).toBeDefined();
    expect(typeof articles[0].source.name).toBe("string");
  });
});

describe("RSS_FEEDS env var override", () => {
  afterEach(() => {
    delete process.env.RSS_FEEDS;
    jest.resetModules();
  });

  it("fetches only the configured feed URL when RSS_FEEDS env is set", async () => {
    const customUrl = "https://custom.example.com/rss";
    process.env.RSS_FEEDS = customUrl;

    const mockParse = jest.fn().mockResolvedValue({ title: "Custom Feed", items: [] });
    jest.resetModules();
    jest.doMock("rss-parser", () =>
      jest.fn().mockImplementation(() => ({ parseURL: mockParse }))
    );

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { fetchRssFeeds: freshFetch } = require("../scripts/rss") as typeof import("../scripts/rss");
    await freshFetch();

    expect(mockParse).toHaveBeenCalledTimes(1);
    expect(mockParse).toHaveBeenCalledWith(customUrl);
  });
});
