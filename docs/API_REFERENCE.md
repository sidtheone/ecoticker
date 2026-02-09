# API Reference: EcoTicker

**Version:** 1.0.0
**Base URL:** `http://localhost:3000/api` (development) or your deployed domain
**Authentication:** X-API-Key header for write operations

---

## Table of Contents

- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Public Endpoints](#public-endpoints)
- [Protected Endpoints](#protected-endpoints)
- [Error Responses](#error-responses)
- [Data Models](#data-models)

---

## Authentication

### API Key Authentication

All write operations (POST, PUT, DELETE) require authentication via the `X-API-Key` header.

**Header Format:**
```http
X-API-Key: your_admin_api_key_here
```

**Environment Variable:**
```bash
ADMIN_API_KEY=<generate with: openssl rand -base64 32>
```

**Unauthorized Response:**
```json
{
  "error": "Unauthorized: Valid API key required",
  "status": 401
}
```

**Rate Limit Exceeded:**
```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 60
}
```

---

## Rate Limiting

Rate limits are enforced per IP address:

| Operation Type | Limit | Window | Endpoints |
|---------------|-------|--------|-----------|
| Read | 100 requests | 1 minute | GET endpoints |
| Write | 10 requests | 1 minute | POST/PUT/DELETE |
| Batch Operations | 2 requests | 1 hour | /batch, /seed, /cleanup |

**Response Headers:**
- `Retry-After`: Seconds until rate limit resets
- `X-RateLimit-Reset`: Unix timestamp when limit resets

---

## Public Endpoints

### Topics

#### List Topics

**GET** `/api/topics`

Retrieve all environmental topics with optional filtering.

**Query Parameters:**
| Parameter | Type | Values | Description |
|-----------|------|--------|-------------|
| `urgency` | string | `breaking`, `critical`, `moderate`, `informational` | Filter by urgency level |
| `category` | string | `health`, `ecology`, `economy` | Filter by category |

**Response:**
```json
{
  "topics": [
    {
      "id": 1,
      "slug": "wildfire-impact-western-regions",
      "title": "Wildfire Impact (Western Regions)",
      "description": "Tracking wildfire severity and spread in western regions",
      "currentScore": 78,
      "previousScore": 72,
      "change": 6,
      "urgency": "critical",
      "category": "ecology",
      "region": "Western US",
      "articleCount": 12,
      "updatedAt": "2026-02-09T10:30:00Z",
      "sparkline": [65, 68, 72, 75, 78]
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Success
- `400 Bad Request`: Invalid query parameter value
- `500 Internal Server Error`: Server error

**Example:**
```bash
# Get all critical topics
curl "http://localhost:3000/api/topics?urgency=critical"

# Get all ecology-related topics
curl "http://localhost:3000/api/topics?category=ecology"
```

---

#### Get Topic Details

**GET** `/api/topics/[slug]`

Retrieve detailed information about a specific topic, including articles and score history.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | string | URL-friendly topic identifier |

**Response:**
```json
{
  "topic": {
    "id": 1,
    "slug": "wildfire-impact-western-regions",
    "title": "Wildfire Impact (Western Regions)",
    "description": "Tracking wildfire severity and spread",
    "currentScore": 78,
    "previousScore": 72,
    "change": 6,
    "urgency": "critical",
    "category": "ecology",
    "region": "Western US",
    "updatedAt": "2026-02-09T10:30:00Z"
  },
  "articles": [
    {
      "id": 101,
      "title": "California Wildfires Intensify",
      "url": "https://example.com/article",
      "source": "Environmental News",
      "summary": "Recent wildfires have expanded...",
      "imageUrl": "https://example.com/image.jpg",
      "publishedAt": "2026-02-08T14:00:00Z"
    }
  ],
  "scoreHistory": [
    {
      "score": 78,
      "healthScore": 65,
      "ecologyScore": 85,
      "economyScore": 72,
      "recordedAt": "2026-02-09T00:00:00Z"
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Success
- `404 Not Found`: Topic slug not found
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl "http://localhost:3000/api/topics/wildfire-impact-western-regions"
```

---

### Ticker

#### Get Ticker Items

**GET** `/api/ticker`

Retrieve top 15 topics for the scrolling ticker display (lightweight payload).

**Response:**
```json
{
  "items": [
    {
      "slug": "wildfire-impact-western-regions",
      "title": "Wildfire Impact (Western Regions)",
      "score": 78,
      "change": 6,
      "urgency": "critical"
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Success
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl "http://localhost:3000/api/ticker"
```

---

### Movers

#### Get Biggest Movers

**GET** `/api/movers`

Retrieve top 5 topics with the largest absolute score changes.

**Response:**
```json
{
  "movers": [
    {
      "id": 1,
      "slug": "wildfire-impact-western-regions",
      "title": "Wildfire Impact (Western Regions)",
      "currentScore": 78,
      "previousScore": 72,
      "change": 6,
      "urgency": "critical",
      "category": "ecology",
      "region": "Western US",
      "articleCount": 12,
      "sparkline": [65, 68, 72, 75, 78]
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Success
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl "http://localhost:3000/api/movers"
```

---

### Articles

#### List Articles

**GET** `/api/articles`

Retrieve articles with optional filtering and pagination.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `topicId` | number | Filter by topic ID |
| `source` | string | Filter by article source |
| `url` | string | Filter by exact URL |
| `limit` | number | Items per page (default: 20, max: 100) |
| `offset` | number | Pagination offset (default: 0) |

**Response:**
```json
{
  "articles": [
    {
      "id": 101,
      "topicId": 1,
      "title": "California Wildfires Intensify",
      "url": "https://example.com/article",
      "source": "Environmental News",
      "summary": "Recent wildfires have expanded...",
      "imageUrl": "https://example.com/image.jpg",
      "publishedAt": "2026-02-08T14:00:00Z",
      "topic": {
        "slug": "wildfire-impact-western-regions",
        "title": "Wildfire Impact (Western Regions)"
      }
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0
  }
}
```

**Status Codes:**
- `200 OK`: Success
- `400 Bad Request`: Invalid query parameters
- `500 Internal Server Error`: Server error

**Example:**
```bash
# Get articles for a specific topic
curl "http://localhost:3000/api/articles?topicId=1&limit=10"
```

---

#### Get Single Article

**GET** `/api/articles/[id]`

Retrieve a specific article with its associated topic.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Article ID |

**Response:**
```json
{
  "article": {
    "id": 101,
    "topicId": 1,
    "title": "California Wildfires Intensify",
    "url": "https://example.com/article",
    "source": "Environmental News",
    "summary": "Recent wildfires have expanded...",
    "imageUrl": "https://example.com/image.jpg",
    "publishedAt": "2026-02-08T14:00:00Z"
  },
  "topic": {
    "slug": "wildfire-impact-western-regions",
    "title": "Wildfire Impact (Western Regions)"
  }
}
```

**Status Codes:**
- `200 OK`: Success
- `404 Not Found`: Article ID not found
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl "http://localhost:3000/api/articles/101"
```

---

## Protected Endpoints

All protected endpoints require the `X-API-Key` header with a valid admin API key.

### Articles Management

#### Create Article

**POST** `/api/articles`

Create a new article.

**Request Body:**
```json
{
  "topicId": 1,
  "title": "New Environmental Study Released",
  "url": "https://example.com/new-article",
  "source": "Science Journal",
  "summary": "A comprehensive study reveals...",
  "imageUrl": "https://example.com/image.jpg",
  "publishedAt": "2026-02-09T12:00:00Z"
}
```

**Validation Rules:**
- `topicId`: Required, must be a valid topic ID
- `title`: Required, 1-500 characters
- `url`: Required, valid URL format
- `source`: Required, 1-200 characters
- `summary`: Optional, max 2000 characters
- `imageUrl`: Optional, valid URL format
- `publishedAt`: Optional, ISO 8601 date string

**Response:**
```json
{
  "article": {
    "id": 102,
    "topicId": 1,
    "title": "New Environmental Study Released",
    "url": "https://example.com/new-article",
    "source": "Science Journal",
    "summary": "A comprehensive study reveals...",
    "imageUrl": "https://example.com/image.jpg",
    "publishedAt": "2026-02-09T12:00:00Z"
  }
}
```

**Status Codes:**
- `201 Created`: Article created successfully
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Missing or invalid API key
- `409 Conflict`: Article with URL already exists
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl -X POST "http://localhost:3000/api/articles" \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "topicId": 1,
    "title": "New Study on Climate Impact",
    "url": "https://example.com/article",
    "source": "Environmental Journal"
  }'
```

---

#### Update Article

**PUT** `/api/articles/[id]`

Update an existing article.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Article ID |

**Request Body:** (all fields optional)
```json
{
  "title": "Updated Title",
  "summary": "Updated summary...",
  "imageUrl": "https://example.com/new-image.jpg"
}
```

**Response:**
```json
{
  "article": {
    "id": 102,
    "topicId": 1,
    "title": "Updated Title",
    "url": "https://example.com/article",
    "source": "Environmental Journal",
    "summary": "Updated summary...",
    "imageUrl": "https://example.com/new-image.jpg",
    "publishedAt": "2026-02-09T12:00:00Z"
  }
}
```

**Status Codes:**
- `200 OK`: Article updated successfully
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Missing or invalid API key
- `404 Not Found`: Article ID not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

#### Delete Article

**DELETE** `/api/articles/[id]`

Delete a specific article.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Article ID |

**Response:**
```json
{
  "success": true,
  "message": "Article deleted successfully"
}
```

**Status Codes:**
- `200 OK`: Article deleted successfully
- `401 Unauthorized`: Missing or invalid API key
- `404 Not Found`: Article ID not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

#### Batch Delete Articles

**DELETE** `/api/articles`

Delete multiple articles by filters.

**Request Body:**
```json
{
  "topicId": 1,
  "source": "Old Source",
  "url": "https://example.com/old-article",
  "ids": [101, 102, 103]
}
```

**Validation Rules:**
- At least one filter required (`topicId`, `source`, `url`, or `ids`)
- `ids`: Optional array of article IDs
- Other fields follow same rules as creation

**Response:**
```json
{
  "success": true,
  "deletedCount": 3,
  "message": "Deleted 3 articles"
}
```

**Status Codes:**
- `200 OK`: Articles deleted successfully
- `400 Bad Request`: No filters provided or validation error
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

### Topics Management

#### Delete Topics

**DELETE** `/api/topics`

Delete topics by filters (with cascade delete of articles).

**Request Body:**
```json
{
  "ids": [1, 2, 3],
  "articleCount": 0
}
```

**Validation Rules:**
- At least one filter required (`ids` or `articleCount`)
- `ids`: Optional array of topic IDs
- `articleCount`: Optional number (e.g., `0` deletes empty topics)

**Response:**
```json
{
  "success": true,
  "deletedCount": 2,
  "message": "Deleted 2 topics and their articles"
}
```

**Status Codes:**
- `200 OK`: Topics deleted successfully
- `400 Bad Request`: No filters provided
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

### Batch Operations

#### Run Batch Processing

**POST** `/api/batch`

Manually trigger the batch processing pipeline (NewsAPI → LLM classification → scoring).

**Request Body:** (none required)

**Response:**
```json
{
  "success": true,
  "message": "Batch processing completed",
  "stats": {
    "articlesProcessed": 45,
    "topicsUpdated": 12,
    "duration": "2.5s"
  }
}
```

**Status Codes:**
- `200 OK`: Batch completed successfully
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded (2/hour)
- `500 Internal Server Error`: Server error

**Example:**
```bash
curl -X POST "http://localhost:3000/api/batch" \
  -H "X-API-Key: your_api_key"
```

---

#### Seed Database

**POST** `/api/seed`

Populate database with demo data (12 topics, 36 articles, 84 history entries).

**Response:**
```json
{
  "success": true,
  "message": "Database seeded successfully",
  "data": {
    "topics": 12,
    "articles": 36,
    "scoreHistory": 84
  }
}
```

**Status Codes:**
- `200 OK`: Seeding completed successfully
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded (2/hour)
- `500 Internal Server Error`: Server error

---

#### Cleanup Database

**POST** `/api/cleanup`

Remove all demo/seed data from the database.

**Response:**
```json
{
  "success": true,
  "message": "Cleanup completed",
  "deleted": {
    "articles": 36,
    "topics": 12,
    "scoreHistory": 84
  }
}
```

**Status Codes:**
- `200 OK`: Cleanup completed successfully
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded (2/hour)
- `500 Internal Server Error`: Server error

---

### Audit Logs

#### View Audit Logs

**GET** `/api/audit-logs`

Retrieve audit logs and statistics for all write operations.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Number of logs to return (default: 50) |
| `offset` | number | Pagination offset (default: 0) |

**Response:**
```json
{
  "logs": [
    {
      "id": 1,
      "timestamp": "2026-02-09T10:30:00Z",
      "ipAddress": "192.168.1.1",
      "endpoint": "/api/articles",
      "method": "POST",
      "action": "create_article",
      "success": true,
      "details": "{\"articleId\":101}",
      "userAgent": "curl/7.68.0"
    }
  ],
  "statistics": {
    "totalOperations": 245,
    "successfulOperations": 238,
    "failedOperations": 7,
    "successRate": "97.1%",
    "uniqueIPs": 12,
    "recentFailures": 2,
    "topActions": [
      { "action": "create_article", "count": 89 },
      { "action": "delete_article", "count": 56 }
    ]
  }
}
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Missing or invalid API key
- `500 Internal Server Error`: Server error

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message here",
  "status": 400,
  "requestId": "req_abc123",
  "details": {
    "field": "validation error details"
  }
}
```

**Common Error Fields:**
- `error`: Human-readable error message
- `status`: HTTP status code
- `requestId`: Unique request identifier for debugging
- `details`: Additional error context (development only)

**HTTP Status Codes:**
- `400 Bad Request`: Invalid input or validation error
- `401 Unauthorized`: Missing or invalid API key
- `404 Not Found`: Resource not found
- `409 Conflict`: Duplicate resource (e.g., URL already exists)
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

---

## Data Models

### Topic

```typescript
interface Topic {
  id: number;
  slug: string;                    // URL-friendly identifier
  title: string;
  description: string;
  currentScore: number;            // 0-100
  previousScore: number | null;    // 0-100
  change: number;                  // currentScore - previousScore
  urgency: 'breaking' | 'critical' | 'moderate' | 'informational';
  category: 'health' | 'ecology' | 'economy';
  region: string;
  articleCount: number;
  updatedAt: string;               // ISO 8601
  sparkline?: number[];            // Last 7 days of scores
}
```

### Article

```typescript
interface Article {
  id: number;
  topicId: number;
  title: string;
  url: string;                     // Unique
  source: string;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: string | null;      // ISO 8601
}
```

### Score History Entry

```typescript
interface ScoreHistoryEntry {
  score: number;                   // 0-100
  healthScore: number;             // 0-100
  ecologyScore: number;            // 0-100
  economyScore: number;            // 0-100
  recordedAt: string;              // ISO 8601
}
```

### Urgency Levels

| Urgency | Score Range | Color | Description |
|---------|-------------|-------|-------------|
| `breaking` | 80-100 | Red | Immediate action required |
| `critical` | 60-79 | Orange | Significant concern |
| `moderate` | 30-59 | Yellow | Moderate impact |
| `informational` | 0-29 | Green | Low concern |

---

## Best Practices

### Authentication

1. **Never commit API keys** to version control
2. **Use environment variables** for key storage
3. **Generate strong keys** using `openssl rand -base64 32`
4. **Rotate keys regularly** in production

### Rate Limiting

1. **Monitor rate limit headers** in responses
2. **Implement exponential backoff** for retries
3. **Cache responses** when possible to reduce requests
4. **Use batch operations** instead of multiple single requests

### Error Handling

1. **Check status codes** before processing responses
2. **Log request IDs** for debugging
3. **Handle 429 responses** with Retry-After header
4. **Validate input** before sending requests

### Performance

1. **Use pagination** for large result sets
2. **Filter results** at the API level instead of client-side
3. **Request only needed fields** (use specific endpoints)
4. **Cache static data** (topics change infrequently)

---

## Example Client Implementation

```javascript
class EcoTickerAPI {
  constructor(baseURL, apiKey = null) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.apiKey && { 'X-API-Key': this.apiKey }),
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new Error(`Rate limit exceeded. Retry after ${retryAfter}s`);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // Public methods
  async getTopics(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/api/topics?${params}`);
  }

  async getTopicDetails(slug) {
    return this.request(`/api/topics/${slug}`);
  }

  async getTicker() {
    return this.request('/api/ticker');
  }

  async getMovers() {
    return this.request('/api/movers');
  }

  // Protected methods (require API key)
  async createArticle(article) {
    return this.request('/api/articles', {
      method: 'POST',
      body: JSON.stringify(article),
    });
  }

  async seedDatabase() {
    return this.request('/api/seed', { method: 'POST' });
  }
}

// Usage
const api = new EcoTickerAPI('http://localhost:3000', 'your_api_key');

// Get all critical topics
const { topics } = await api.getTopics({ urgency: 'critical' });

// Create a new article
const article = await api.createArticle({
  topicId: 1,
  title: 'New Study Released',
  url: 'https://example.com/study',
  source: 'Science Daily'
});
```

---

**Last Updated:** 2026-02-09
**API Version:** 1.0.0
