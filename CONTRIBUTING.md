# Contributing to EcoTicker

## Development Workflow

### Setup

1. **Clone and install:**
   ```bash
   git clone https://github.com/sidtheone/ecoticker.git
   cd ecoticker
   npm install  # Automatically installs git hooks
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Add your API keys to .env
   ```

3. **Seed database:**
   ```bash
   npx tsx scripts/seed.ts
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

---

## ⚠️ CRITICAL: Pre-Commit Checks

**ALL commits MUST pass these checks:**

### Automated Checks (Git Hook)

After `npm install`, a pre-commit hook automatically runs:

1. **TypeScript Type Check**
   ```bash
   npx tsc --noEmit
   ```
   ❌ Blocks commit if type errors exist

2. **Build Check**
   ```bash
   npm run build
   ```
   ❌ Blocks commit if build fails

3. **Linter**
   ```bash
   npm run lint
   ```
   ⚠️  Warns but doesn't block

### Manual Setup (If Needed)

```bash
npm run setup:hooks
```

### Bypass (Emergency Only)

```bash
git commit --no-verify
```

**⚠️ Only use `--no-verify` if:**
- Emergency hotfix needed
- You're fixing the broken build itself
- You understand the risks

**Never bypass for:**
- Regular feature work
- "Will fix later" commits
- Ignoring TypeScript errors

---

## Commit Message Convention

Follow conventional commits:

```bash
# Format
<type>(<scope>): <subject>

# Types
feat:     New feature
fix:      Bug fix
perf:     Performance improvement
refactor: Code refactoring
docs:     Documentation changes
test:     Test changes
chore:    Build/tooling changes
style:    Code style changes

# Examples
feat(api): add caching to topics endpoint
fix(db): handle volume permission errors in Railway
perf: optimize N+1 sparkline query
docs: update Railway deployment guide
```

---

## Code Quality Standards

### TypeScript

- ✅ Strict mode enabled
- ✅ No `any` types without justification
- ✅ Explicit return types for exported functions
- ✅ Proper interface definitions for DB rows

### React

- ✅ Functional components only
- ✅ Proper dependency arrays in useEffect
- ✅ Memoization for expensive operations
- ✅ Proper key props in lists

### API Routes

- ✅ Input validation on all parameters
- ✅ Try-catch error handling
- ✅ Proper HTTP status codes
- ✅ Cache-Control headers where appropriate

### Database

- ✅ Parameterized queries (never string concatenation)
- ✅ Proper indexes on filtered columns
- ✅ Foreign key constraints enabled
- ✅ WAL mode for better concurrency

---

## Testing

Run tests before submitting PR:

```bash
# All tests
npx jest

# With coverage
npx jest --coverage

# Specific test
npx jest tests/api-topics.test.ts
```

**Minimum coverage:** 95% statements

---

## Pull Request Process

1. **Create feature branch:**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make changes with commits that pass pre-commit hooks**

3. **Push to GitHub:**
   ```bash
   git push origin feat/your-feature-name
   ```

4. **Create PR** with description:
   - What changes were made
   - Why they were needed
   - How to test them

5. **Ensure CI passes:**
   - ✅ Dependency audit
   - ✅ Security linting
   - ✅ Dockerfile check
   - ✅ Test suite (114 tests)

6. **Request review**

---

## Railway Deployment

When merging to `main`:

- Railway auto-deploys from GitHub
- Monitor deployment logs for errors
- Verify at: `https://your-app.railway.app`
- Run smoke tests on production

---

## Getting Help

- **Bug reports:** GitHub Issues
- **Questions:** GitHub Discussions
- **Documentation:** See README.md, CLAUDE.md, deployment docs

---

## License

See LICENSE file for details.
