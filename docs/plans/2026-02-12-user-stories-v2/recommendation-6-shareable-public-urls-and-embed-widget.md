# Recommendation #6: Shareable Public URLs and Embed Widget

> Godin: "The product is trapped inside the app. There's no way to share it. The ticker bar is the remarkable thing — but nobody outside the app can see it."

## US-6.1: Share a topic page with rich social previews
**As a** journalist, **I want** to share a link to a topic's status page that looks good on social media, **so that** I can reference EcoTicker in my articles and tweets.

**User journey (Jordan, journalist):**
1. Jordan writes an article about Amazon deforestation
2. Wants to cite EcoTicker: "According to EcoTicker, the ecological impact is rated SIGNIFICANT (72/100)"
3. Pastes `ecoticker.com/topic/amazon-deforestation` into their article
4. On Twitter, the link shows a rich card: "Amazon Deforestation — Score: 82 (BREAKING) | EcoTicker" with a description and image

**Architectural note:** The topic detail page (`src/app/topic/[slug]/page.tsx`) is currently `"use client"`. OG meta tags MUST be server-rendered for social crawlers (Twitter/LinkedIn don't execute JavaScript). Next.js App Router supports this via `generateMetadata()` in a server component. Options:
1. Split the page: server layout with `generateMetadata()` + client interactive section
2. Move metadata to a `layout.tsx` in the `topic/[slug]/` directory
3. Fetch topic data server-side for metadata, pass to client component via props

Option 2 is cleanest with Next.js App Router conventions.

**Acceptance Criteria:**
- Add `src/app/topic/[slug]/layout.tsx` (server component) with `generateMetadata()`:
  - Fetches topic data server-side (direct DB call, not API fetch)
  - Sets `og:title`: "[Topic Name] — Score: [Score] ([URGENCY]) | EcoTicker"
  - Sets `og:description`: topic's overallSummary or impactSummary (first 200 chars)
  - Sets `og:image`: static fallback initially. Dynamic via US-6.3 later.
  - Sets `og:url`: canonical URL
  - Sets Twitter card meta tags
- "Share" button on topic detail page:
  - Copies current URL to clipboard
  - Shows brief "Link copied!" confirmation (2s fade)
  - Uses Clipboard API with `<button>` (not navigator.share — broader support)
- `<title>` tag includes topic name + score

**Complexity:** S (layout file + generateMetadata + share button)
**Dependencies:** None for basic implementation. US-1.1 enriches `og:description` with overallSummary.

---

## US-6.2: Embed a live topic widget on external websites
**As a** blogger or journalist, **I want** to embed a live EcoTicker widget on my site, **so that** readers can see current environmental scores without leaving my page.

**User journey (Jordan, journalist):**
1. Jordan writes a long-form piece about Arctic sea ice
2. Wants to show live data inline: the current score and trend
3. Goes to the Arctic Ice topic on EcoTicker
4. Clicks "Embed" → gets: `<iframe src="ecoticker.com/embed/arctic-sea-ice-decline?theme=light" width="300" height="150" />`
5. Pastes into their CMS. Readers see a live mini-widget with score, sparkline, and urgency badge.

**Acceptance Criteria:**
- New route: `/embed/[slug]/page.tsx` — minimal page with NO navigation, header, or footer
- Renders: topic name (small), current score (large, colored), urgency badge, sparkline
- Auto-refreshes every 5 minutes (same as TickerBar)
- Theme via query param: `?theme=dark` or `?theme=light` (default: light)
- Dimensions: designed for 300x150 (default) but responsive within iframe
- "Copy embed code" button on the topic detail page (near the Share button from US-6.1)
- CSP: update middleware to allow framing from any origin for `/embed/*` routes (currently CSP blocks framing)
- Minimal JS bundle — embed page should be lightweight

**Complexity:** M (new route + responsive mini-component + CSP update + embed code generator)
**Dependencies:** None

---

## US-6.3: Generate dynamic social card images
**As a** social media user, **I want** visually appealing preview cards when sharing EcoTicker links, **so that** shared links attract clicks and convey information at a glance.

**User journey:** Jordan shares `ecoticker.com/topic/arctic-sea-ice-decline` on Twitter. Instead of a generic placeholder, the card shows: "Arctic Sea Ice Decline" in bold, a large "85" in red, "BREAKING" badge, mini sparkline, and three small sub-score bars (health/eco/econ).

**Acceptance Criteria:**
- New API route: `/api/og/[slug]/route.tsx` using Next.js `ImageResponse` (built-in OG image generation)
- Image content: topic name, current score (large, colored by urgency), urgency badge, sparkline (simplified SVG), sub-score mini bars (3 horizontal bars with labels)
- Dimensions: 1200x630 (Twitter/LinkedIn standard)
- Referenced by `og:image` in US-6.1's `generateMetadata()`
- Cache strategy: images cached by CDN. URL includes score hash so it regenerates when score changes: `/api/og/[slug]?v=[score]`
- Graceful degradation: if sub-scores aren't available (pre-US-1.1 or all INSUFFICIENT_DATA), show only overall score

**Complexity:** M (OG image generation with layout + data fetching)
**Dependencies:** US-6.1 (provides the generateMetadata() that references this image). US-1.1 enhances with sub-score bars.

---
