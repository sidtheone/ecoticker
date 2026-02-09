# EcoTicker Documentation

Welcome to the comprehensive documentation for EcoTicker, an environmental news impact tracking system with real-time scoring and stock-ticker style visualization.

---

## 📚 Documentation Index

### Core Documentation

1. **[API Reference](./API_REFERENCE.md)** — Complete API documentation
   - All 11 endpoints (public + protected)
   - Request/response formats
   - Authentication and rate limiting
   - Error handling
   - Example client implementation

2. **[Component Guide](./COMPONENT_GUIDE.md)** — React component documentation
   - All 11 components explained
   - Props, usage examples, and patterns
   - Server vs Client components
   - Theme system details
   - Testing strategies

3. **[Database Guide](./DATABASE_GUIDE.md)** — PostgreSQL schema and queries
   - 5 table schemas with indexes
   - Common query patterns
   - Relationships and constraints
   - Best practices
   - Testing with pg-mem

4. **[Development Guide](./DEVELOPMENT_GUIDE.md)** — Developer onboarding
   - Setup instructions
   - Development workflow
   - Coding standards
   - Testing guide
   - Troubleshooting

5. **[Architecture](./ARCHITECTURE.md)** — System design documentation
   - High-level architecture diagrams
   - Data flow and component hierarchy
   - Database and API design
   - Security architecture
   - Scalability considerations

6. **[Security](./SECURITY.md)** — Security documentation
   - Threat model and mitigations
   - Authentication/authorization
   - SQL injection prevention
   - Rate limiting
   - Audit logging
   - Deployment security

### Specialized Guides

7. **[Token Efficiency Report](./TOKEN_EFFICIENCY_REPORT.md)** — AI context optimization
   - 94% token reduction strategy
   - ROI analysis (53,500 tokens saved per session)
   - Best practices for AI-assisted development

8. **[Deployment Guide](../deployment.md)** — Production deployment
   - Railway deployment process
   - Docker setup
   - Environment configuration
   - Database migrations

9. **[Project Index](../PROJECT_INDEX.md)** — Quick reference
   - File structure overview
   - Entry points
   - All endpoints and components
   - Stack information

---

## 🚀 Quick Start

### For Developers

1. **Start here:** [Development Guide](./DEVELOPMENT_GUIDE.md)
   - Complete setup instructions
   - Daily development workflow
   - Testing and debugging

2. **Understand the architecture:** [Architecture](./ARCHITECTURE.md)
   - System design overview
   - Data flow diagrams
   - Design decisions

3. **Read the code:** [Project Index](../PROJECT_INDEX.md)
   - Navigate the codebase efficiently
   - Find specific files and components

### For API Consumers

1. **API Reference:** [API_REFERENCE.md](./API_REFERENCE.md)
   - All endpoints documented
   - Authentication setup
   - Example requests

2. **Security:** [SECURITY.md](./SECURITY.md)
   - API key generation
   - Rate limiting
   - Best practices

### For AI Assistants (Claude, GPT, etc.)

1. **Always start with:** [Project Index](../PROJECT_INDEX.md)
   - Saves 53,500 tokens per session (94% reduction)
   - Complete project overview in 3,500 tokens

2. **Then reference:** Specific guides as needed
   - [Component Guide](./COMPONENT_GUIDE.md) for UI work
   - [Database Guide](./DATABASE_GUIDE.md) for data operations
   - [API Reference](./API_REFERENCE.md) for endpoint details

3. **See:** [Token Efficiency Report](./TOKEN_EFFICIENCY_REPORT.md)
   - Best practices for efficient context usage
   - When to read full files vs index

---

## 📊 Project Overview

### What is EcoTicker?

EcoTicker aggregates environmental news from NewsAPI, uses LLM analysis (OpenRouter) to classify and score articles, then displays impact scores in a stock-ticker style dashboard with sparklines and trend indicators.

### Key Features

- **Real-time Scoring:** Environmental topics scored 0-100 with urgency levels (breaking/critical/moderate/informational)
- **Stock Ticker UI:** Scrolling marquee display of top topics
- **Interactive Dashboard:** Filterable topic grid with sparklines
- **Detailed Analytics:** Full score charts with health/ecology/economy sub-scores
- **Article Tracking:** News articles linked to topics with source and date
- **Batch Processing:** Daily automated pipeline (cron at 6AM UTC)
- **Theme Support:** Light/dark mode with warm cream/beige light palette
- **Security:** API key auth, rate limiting, input validation, audit logging
- **Production-Ready:** Docker deployment with nginx, PostgreSQL, and health checks

### Technology Stack

- **Frontend:** React 19, Next.js 16 (App Router), Tailwind CSS 4, Recharts
- **Backend:** Next.js API routes, TypeScript 5
- **Database:** PostgreSQL 16 with pg (node-postgres)
- **Validation:** Zod 4.3
- **Testing:** Jest 30, React Testing Library, pg-mem (98.6% coverage)
- **Deployment:** Docker, Docker Compose, Nginx, Railway

---

## 📖 Documentation by Role

### Frontend Developer

**Primary Guides:**
1. [Component Guide](./COMPONENT_GUIDE.md)
2. [Development Guide](./DEVELOPMENT_GUIDE.md) (Coding Standards section)
3. [Architecture](./ARCHITECTURE.md) (Component Architecture section)

**Key Topics:**
- Server vs Client components
- Theme system (ThemeProvider, ThemeToggle)
- Data fetching patterns
- Tailwind CSS 4 usage
- Testing components

### Backend Developer

**Primary Guides:**
1. [API Reference](./API_REFERENCE.md)
2. [Database Guide](./DATABASE_GUIDE.md)
3. [Security](./SECURITY.md)

**Key Topics:**
- API route structure
- Database operations
- Authentication/authorization
- Input validation (Zod)
- SQL injection prevention

### DevOps Engineer

**Primary Guides:**
1. [Deployment Guide](../deployment.md)
2. [Architecture](./ARCHITECTURE.md) (Deployment Architecture section)
3. [Security](./SECURITY.md) (Deployment Security section)

**Key Topics:**
- Docker multi-container setup
- Nginx configuration
- Environment variables
- PostgreSQL setup
- Railway deployment

### Security Auditor

**Primary Guide:**
1. [Security](./SECURITY.md)

**Key Topics:**
- Threat model
- Authentication/authorization
- SQL injection prevention
- Rate limiting
- Audit logging
- CSP and security headers

### Product Manager

**Primary Guides:**
1. [Architecture](./ARCHITECTURE.md) (System Overview)
2. [API Reference](./API_REFERENCE.md) (Endpoints overview)
3. [Project Index](../PROJECT_INDEX.md)

**Key Topics:**
- Feature overview
- Data flow
- API capabilities
- Performance characteristics
- Scalability considerations

---

## 🔍 Finding Information

### Common Questions

**Q: How do I set up the development environment?**
→ [Development Guide § Getting Started](./DEVELOPMENT_GUIDE.md#getting-started)

**Q: How do I authenticate API requests?**
→ [API Reference § Authentication](./API_REFERENCE.md#authentication)

**Q: What's the database schema?**
→ [Database Guide § Schema Definition](./DATABASE_GUIDE.md#schema-definition)

**Q: How do I add a new component?**
→ [Component Guide § Component Patterns](./COMPONENT_GUIDE.md#component-patterns)

**Q: How does the theme system work?**
→ [Component Guide § Theme System](./COMPONENT_GUIDE.md#theme-system)

**Q: How do I deploy to production?**
→ [Deployment Guide](../deployment.md)

**Q: How do I prevent SQL injection?**
→ [Security § SQL Injection Prevention](./SECURITY.md#sql-injection-prevention)

**Q: What's the rate limiting policy?**
→ [API Reference § Rate Limiting](./API_REFERENCE.md#rate-limiting)

**Q: How do I test components?**
→ [Component Guide § Testing Components](./COMPONENT_GUIDE.md#testing-components)

**Q: How do I add a new API endpoint?**
→ [Development Guide § API Route Structure](./DEVELOPMENT_GUIDE.md#api-route-structure)

---

## 🎯 Documentation Quality Metrics

### Coverage

- ✅ **100% API endpoints documented** (11/11)
- ✅ **100% components documented** (11/11)
- ✅ **100% database tables documented** (5/5)
- ✅ **Security features comprehensively covered**
- ✅ **Deployment process documented**
- ✅ **Testing strategies explained**

### Code Examples

- **350+ code snippets** across all guides
- **TypeScript examples** for type safety
- **React component examples** for UI patterns
- **SQL query examples** for database operations
- **Docker/Nginx examples** for deployment
- **Testing examples** for quality assurance

### Diagrams

- System architecture diagram
- Component hierarchy tree
- Data flow diagrams
- Docker container setup
- Entity-relationship diagram (ERD)

---

## 📝 Contributing to Documentation

### Documentation Standards

**Format:** Markdown with GitHub-flavored extensions

**Structure:**
- Clear hierarchy with H1-H6 headings
- Table of contents for long documents
- Code blocks with language identifiers
- Tables for structured data
- Examples for complex concepts

**Code Examples:**
```typescript
// Use TypeScript for code examples
interface Example {
  field: string;
  optional?: number;
}

// Include inline comments for clarity
function exampleFunction(input: Example): void {
  // Explain what this does
  console.log(input.field);
}
```

**Style:**
- Active voice ("Use this pattern" not "This pattern can be used")
- Second person ("You should..." not "One should...")
- Present tense ("The API returns..." not "The API will return...")
- Concise and scannable

### Updating Documentation

**When to Update:**
- Adding new features or endpoints
- Changing existing behavior
- Security improvements
- Architecture changes
- Bug fixes that affect usage

**Checklist:**
- [ ] Update relevant guide(s)
- [ ] Add code examples
- [ ] Update diagrams if needed
- [ ] Update Project Index (if adding files)
- [ ] Update this README (if adding new guides)
- [ ] Update "Last Updated" date at bottom of guide

---

## 🏆 Documentation Awards

This documentation set has been designed with the following principles:

1. **Completeness:** Every aspect of the system is documented
2. **Clarity:** Plain language with examples
3. **Organization:** Logical structure with cross-references
4. **Maintainability:** Easy to update as code evolves
5. **Accessibility:** Multiple entry points for different roles
6. **Efficiency:** Token-optimized for AI assistants (94% reduction)

---

## 🔗 External Resources

### Next.js
- [Next.js 16 Documentation](https://nextjs.org/docs)
- [App Router Guide](https://nextjs.org/docs/app)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)

### React
- [React 19 Docs](https://react.dev)
- [React Testing Library](https://testing-library.com/react)

### PostgreSQL
- [PostgreSQL 16 Docs](https://www.postgresql.org/docs/16/)
- [pg (node-postgres)](https://node-postgres.com/)

### TypeScript
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TypeScript with Next.js](https://nextjs.org/docs/app/building-your-application/configuring/typescript)

### Tailwind CSS
- [Tailwind CSS 4 Docs](https://tailwindcss.com/docs)
- [Tailwind with Next.js](https://tailwindcss.com/docs/guides/nextjs)

### Testing
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [pg-mem](https://github.com/oguimbal/pg-mem)

### Deployment
- [Railway Docs](https://docs.railway.app/)
- [Docker Docs](https://docs.docker.com/)

---

## 📧 Support

For questions, issues, or contributions:

- **GitHub Issues:** [github.com/sidtheone/ecoticker/issues](https://github.com/sidtheone/ecoticker/issues)
- **Documentation Updates:** Submit PR with changes
- **Security Issues:** See [SECURITY.md](./SECURITY.md) for reporting

---

**Documentation Version:** 1.0.0
**Last Updated:** 2026-02-09
**Project Version:** 0.1.0
