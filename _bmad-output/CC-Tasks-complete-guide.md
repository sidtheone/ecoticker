# Claude Code Task Management: Complete Guide

> **Last Updated:** January 23, 2026
> **Claude Code Version:** 2.1.16+
> **Feature:** Task Management with Dependency Tracking

---

## Table of Contents

### Part 1: Task Management Fundamentals
1. [What Are Claude Code Tasks?](#what-are-claude-code-tasks)
2. [Task Lifecycle & Status Management](#task-lifecycle--status-management)
3. [The TodoWrite Tool](#the-todowrite-tool)
4. [Viewing & Managing Tasks](#viewing--managing-tasks)

### Part 2: Task Dependencies
5. [Understanding Task Dependencies](#understanding-task-dependencies)
6. [The blockedBy Field Deep Dive](#the-blockedby-field-deep-dive)
7. [Dependency Execution Model](#dependency-execution-model)
8. [Dependency Patterns & Graphs](#dependency-patterns--graphs)
9. [When to Use Dependencies](#when-to-use-dependencies)

### Part 3: Practical Application
10. [Quick Start](#quick-start)
11. [How to Use: Step-by-Step](#how-to-use-step-by-step)
12. [Common Patterns](#common-patterns)
13. [Advanced Usage](#advanced-usage)

### Part 4: Real-World Implementation
14. [Multi-Session Collaboration](#multi-session-collaboration)
15. [Team Workflows](#team-workflows)
16. [Real-World Examples](#real-world-examples)

### Part 5: Reference & Troubleshooting
17. [Best Practices](#best-practices)
18. [Troubleshooting Guide](#troubleshooting-guide)
19. [Complete Syntax Reference](#complete-syntax-reference)

---

# Part 1: Task Management Fundamentals

## What Are Claude Code Tasks?

Claude Code includes a powerful built-in **task management system** that helps you organize, track, and execute complex projects. The system is built around the **TodoWrite** tool, which allows Claude to:

- **Create tasks** - Break down projects into manageable steps
- **Track progress** - Monitor which tasks are pending, in progress, or completed
- **Manage execution** - Determine the optimal order to tackle tasks
- **Collaborate** - Share task lists across sessions and team members
- **Coordinate work** - Ensure dependencies are respected and work flows smoothly

### Core Capabilities

**Task Creation**
```
"Build a REST API with authentication. Track it."
```

Claude automatically creates structured tasks:
- Set up project structure
- Create database schema
- Implement authentication
- Build API endpoints
- Write tests

**Progress Tracking**
Press `Ctrl+T` or ask "Show me all tasks" to see:
- ✅ Completed tasks
- 🔧 Tasks in progress
- ⏸️ Pending tasks

**Intelligent Execution**
Claude automatically determines:
- Which task to work on next
- Which tasks can run in parallel
- Which tasks are blocked by dependencies

### Why Use Claude Code Tasks?

✅ **Organize complex projects** - Break large work into manageable pieces
✅ **Track progress** - Always know what's done and what's next
✅ **Work systematically** - Complete tasks in logical order
✅ **Collaborate effectively** - Share progress across sessions
✅ **Prevent mistakes** - Ensure prerequisites complete before dependent work
✅ **Save time** - Run independent tasks in parallel

---

## Task Lifecycle & Status Management

Every task in Claude Code progresses through a lifecycle with three possible states:

### Task Statuses

| Status | Icon | Description | When Used |
|--------|------|-------------|-----------|
| **pending** | ⏸️ | Not started yet | Initial state, may be blocked by dependencies |
| **in_progress** | 🔧 | Currently working | Exactly ONE task should be in_progress at a time |
| **completed** | ✅ | Work finished | Task is done and verified |

### Status Transitions

```
pending → in_progress → completed
  ⏸️         🔧            ✅
```

**Rules:**
- Tasks start as `pending`
- Only ONE task should be `in_progress` at a time
- Mark tasks `completed` immediately after finishing
- Never mark a task `completed` if:
  - Work is incomplete
  - Tests are failing
  - Errors are unresolved
  - Dependencies aren't met

### Task State Management

Claude manages task states automatically:

```json
// Initial state
{"content": "Set up database", "status": "pending"}

// Claude starts work
{"content": "Set up database", "status": "in_progress"}

// After completion
{"content": "Set up database", "status": "completed"}
```

---

## The TodoWrite Tool

The **TodoWrite** tool is how Claude creates and manages tasks. Understanding its structure helps you work effectively with the task system.

### Basic Structure

```json
{
  "todos": [
    {
      "content": "Task description (imperative form)",
      "activeForm": "Task description (present continuous)",
      "status": "pending" | "in_progress" | "completed"
    }
  ]
}
```

### Field Descriptions

| Field | Required | Type | Description | Example |
|-------|----------|------|-------------|---------|
| `content` | Yes | string | Imperative form of task | "Set up database" |
| `activeForm` | Yes | string | Present continuous form | "Setting up database" |
| `status` | Yes | enum | Current task state | "pending", "in_progress", "completed" |
| `blockedBy` | No | string[] | Tasks that must complete first | ["Create schema", "Install tools"] |

### Content vs ActiveForm

**Why two forms?**

- `content`: Used in task lists, commands, and references (imperative: "Do X")
- `activeForm`: Displayed while working (continuous: "Doing X")

**Examples:**
```json
{"content": "Write tests", "activeForm": "Writing tests"}
{"content": "Deploy to staging", "activeForm": "Deploying to staging"}
{"content": "Fix authentication bug", "activeForm": "Fixing authentication bug"}
```

### Creating Tasks

**Natural Language (Recommended)**
```
"I need to build a payment system. Create tasks for:
1. Stripe integration
2. Payment processing
3. Receipt generation
Track it."
```

**Explicit TodoWrite**
```json
{
  "todos": [
    {"content": "Integrate Stripe SDK", "activeForm": "Integrating Stripe SDK", "status": "pending"},
    {"content": "Build payment processor", "activeForm": "Building payment processor", "status": "pending"},
    {"content": "Generate receipts", "activeForm": "Generating receipts", "status": "pending"}
  ]
}
```

---

## Viewing & Managing Tasks

### Viewing Tasks

**Keyboard Shortcut**
```
Ctrl+T    # Toggle task list view
```

**Natural Language**
```
"Show me all tasks"
"What tasks are pending?"
"Which tasks are in progress?"
"List completed tasks"
"Show unblocked tasks only"
```

### Managing Tasks

**Update Status**
```
"Mark 'Set up database' as complete"
"Start working on the next task"
```

**Clear Tasks**
```
"Clear all tasks"
"Remove completed tasks"
```

**Add Tasks**
```
"Add a new task: Create documentation"
```

### Task List IDs

Share tasks across sessions using `CLAUDE_CODE_TASK_LIST_ID`:

```bash
# Session 1
CLAUDE_CODE_TASK_LIST_ID=my-project claude
> "Create tasks for building API"

# Session 2 (sees same tasks)
CLAUDE_CODE_TASK_LIST_ID=my-project claude
> "Show me all tasks"
```

**Use Cases:**
- Project-specific task lists
- Team collaboration
- Long-running projects
- Separating concurrent work

---

# Part 2: Task Dependencies

## Understanding Task Dependencies

**Task dependencies** are the killer feature of Claude Code task management. They define which tasks must complete before others can begin, enabling:

- ✅ **Correct execution order** - Tasks run when ready, not before
- ✅ **Parallel execution** - Independent tasks run simultaneously
- ✅ **Error prevention** - Can't deploy before tests pass
- ✅ **Team coordination** - Clear handoffs and prerequisites
- ✅ **Project planning** - Visualize task relationships

### The Problem Dependencies Solve

**Without Dependencies:**
```
Tasks: [Deploy] [Test] [Build] [Setup]
Order: ??? (random or list order)
Result: 💥 Deploying code that doesn't exist yet!
```

**With Dependencies:**
```
Tasks: [Deploy] ← [Test] ← [Build] ← [Setup]
Order: Setup → Build → Test → Deploy
Result: ✅ Everything works!
```

### How Dependencies Work

Dependencies use **soft enforcement**:

- ✅ **Claude respects them** - Automatically chooses unblocked tasks
- ✅ **Guides execution** - Works in dependency order, not list order
- ⚠️ **Not hard-blocked** - System won't prevent manual overrides
- ✅ **Parallel-aware** - Multiple unblocked tasks can run together

### Dependency Concepts

**Blocking Task:** A task that must complete first
```json
{"content": "Set up database", "status": "pending"}
```

**Blocked Task:** A task waiting for prerequisites
```json
{"content": "Run migrations", "blockedBy": ["Set up database"]}
```

**Unblocked Task:** A task ready to work on
```json
{"content": "Write documentation", "status": "pending"}  // No blockedBy
```

---

## The blockedBy Field Deep Dive

The `blockedBy` field is how you define task dependencies. Understanding its behavior is crucial for effective task management.

### Basic Syntax

```json
{
  "content": "Task name",
  "activeForm": "Doing task name",
  "status": "pending",
  "blockedBy": ["Exact name of blocking task"]
}
```

### Single Dependency

```json
{
  "content": "Deploy to production",
  "activeForm": "Deploying to production",
  "status": "pending",
  "blockedBy": ["Run all tests"]
}
```

**Meaning:** "Don't deploy until tests complete"

### Multiple Dependencies

```json
{
  "content": "Launch to users",
  "activeForm": "Launching to users",
  "status": "pending",
  "blockedBy": ["Deploy to production", "Send marketing email", "Update documentation"]
}
```

**Meaning:** "Don't launch until ALL three tasks complete"

### No Dependencies

```json
// Explicit empty array
{"content": "Write README", "blockedBy": []}

// Omit field entirely
{"content": "Write README"}
```

**Meaning:** "Ready to work on immediately"

### Exact String Matching

**CRITICAL:** `blockedBy` values must match `content` fields **exactly** (case-sensitive):

```json
// ✅ CORRECT - Exact match
[
  {"content": "Set up database", "status": "completed"},
  {"content": "Run migrations", "blockedBy": ["Set up database"]}
]

// ❌ WRONG - Case mismatch
[
  {"content": "Set up database", "status": "completed"},
  {"content": "Run migrations", "blockedBy": ["setup database"]}  // lowercase!
]

// ❌ WRONG - Partial match
[
  {"content": "Set up database schema", "status": "completed"},
  {"content": "Run migrations", "blockedBy": ["Set up database"]}  // incomplete!
]
```

### When Dependencies Unblock

A task unblocks when **ALL** blocking tasks are `completed`:

```json
// Initial state - Deploy is blocked
[
  {"content": "Run tests", "status": "in_progress"},
  {"content": "Security audit", "status": "pending"},
  {"content": "Deploy", "blockedBy": ["Run tests", "Security audit"]}
]

// Tests complete - Deploy still blocked
[
  {"content": "Run tests", "status": "completed"},
  {"content": "Security audit", "status": "in_progress"},
  {"content": "Deploy", "blockedBy": ["Run tests", "Security audit"]}  // Still waiting
]

// All complete - Deploy unblocks!
[
  {"content": "Run tests", "status": "completed"},
  {"content": "Security audit", "status": "completed"},
  {"content": "Deploy", "blockedBy": ["Run tests", "Security audit"]}  // Ready!
]
```

---

## Dependency Execution Model

Understanding how Claude executes tasks with dependencies helps you design better workflows.

### Execution Principles

1. **Dependency Order, Not List Order**
   - Tasks execute based on dependencies, not their position in the list
   - List order is irrelevant for execution

2. **Unblocked Tasks First**
   - Claude always works on tasks with no incomplete dependencies
   - Blocked tasks wait until prerequisites complete

3. **Parallel Execution**
   - Multiple unblocked tasks can run simultaneously
   - Claude may work on several independent tasks at once

4. **One In Progress**
   - Only ONE task should have `in_progress` status at a time
   - Complete current task before starting next

### Execution Example

**You Create:**
```json
[
  {"content": "Deploy", "blockedBy": ["Test"]},
  {"content": "Test", "blockedBy": ["Build"]},
  {"content": "Build", "blockedBy": ["Setup"]},
  {"content": "Setup"},
  {"content": "Lint"}  // Independent
]
```

**Claude Executes:**
```
Round 1: Setup + Lint (parallel - both unblocked)
         ↓
Round 2: Build (after Setup completes)
         ↓
Round 3: Test (after Build completes)
         ↓
Round 4: Deploy (after Test completes)
```

### Parallel Execution Illustrated

```
               Start
                 ↓
            [Setup Project]
                 ↓
    ┌────────────┼────────────┐
    ↓            ↓            ↓
[Build API]  [Build UI]  [Write Docs]  ← All run in parallel
    │            │            │
    └────────────┼────────────┘
                 ↓
        [Integration Tests]             ← Waits for all three
                 ↓
             [Deploy]
```

### Choosing Next Task

When multiple tasks are unblocked, Claude considers:
1. Task complexity and size
2. Natural workflow progression
3. Critical path (tasks blocking others)
4. Your explicit instructions

**You can guide selection:**
```
"Work on the frontend tasks first"
"Focus on the critical path"
"Start with the quickest tasks"
```

---

## Dependency Patterns & Graphs

Common dependency structures you'll use repeatedly.

### Pattern 1: Linear Chain

**When:** Tasks must happen sequentially

```
A → B → C → D
```

```json
[
  {"content": "A", "status": "pending"},
  {"content": "B", "status": "pending", "blockedBy": ["A"]},
  {"content": "C", "status": "pending", "blockedBy": ["B"]},
  {"content": "D", "status": "pending", "blockedBy": ["C"]}
]
```

**Example:**
```
Design → Prototype → Build → Deploy
```

### Pattern 2: Parallel Branches

**When:** Multiple independent tasks, then convergence

```
      A
     / \
    B   C
     \ /
      D
```

```json
[
  {"content": "A", "status": "pending"},
  {"content": "B", "status": "pending", "blockedBy": ["A"]},
  {"content": "C", "status": "pending", "blockedBy": ["A"]},
  {"content": "D", "status": "pending", "blockedBy": ["B", "C"]}
]
```

**Example:**
```
Setup Database
├─→ Build API (parallel)
├─→ Build Admin Panel (parallel)
└─→ Integration Tests (waits for both)
```

### Pattern 3: Diamond Pattern

**When:** Multiple parallel paths that converge

```
       A
      / \
     B   C
     |   |
     D   E
      \ /
       F
```

```json
[
  {"content": "A"},
  {"content": "B", "blockedBy": ["A"]},
  {"content": "C", "blockedBy": ["A"]},
  {"content": "D", "blockedBy": ["B"]},
  {"content": "E", "blockedBy": ["C"]},
  {"content": "F", "blockedBy": ["D", "E"]}
]
```

**Example:**
```
Project Setup
├─→ Frontend Team → Build UI
├─→ Backend Team → Build API
└─→ Integration & Testing (needs both)
```

### Pattern 4: Independent + Convergence

**When:** Several independent tasks all feed into one

```
A (independent)
B (independent)
C (independent)
    ↓
    D (needs A, B, C)
```

```json
[
  {"content": "A"},
  {"content": "B"},
  {"content": "C"},
  {"content": "D", "blockedBy": ["A", "B", "C"]}
]
```

**Example:**
```
Setup Redis (independent)
Setup PostgreSQL (independent)
Setup S3 (independent)
    ↓
Run Integration Tests (needs all infrastructure)
```

### Pattern 5: Phased Execution

**When:** Distinct project phases

```
Phase 1: [A, B, C]
         ↓
Phase 2: [D, E] (blocked by Phase 1)
         ↓
Phase 3: [F] (blocked by Phase 2)
```

```json
[
  // Phase 1 - All independent
  {"content": "A"},
  {"content": "B"},
  {"content": "C"},

  // Phase 2 - Blocked by Phase 1
  {"content": "D", "blockedBy": ["A", "B", "C"]},
  {"content": "E", "blockedBy": ["A", "B", "C"]},

  // Phase 3 - Blocked by Phase 2
  {"content": "F", "blockedBy": ["D", "E"]}
]
```

---

## When to Use Dependencies

### ✅ Use Dependencies When:

1. **Order Matters**
   ```
   ❌ Can't deploy before testing
   ❌ Can't test before building
   ❌ Can't build before setup
   ```

2. **Multiple Steps**
   - 3+ tasks in a logical sequence
   - Clear prerequisites exist
   - Some tasks enable others

3. **Team Collaboration**
   - Multiple people working on same project
   - Clear handoffs needed
   - Work must be coordinated

4. **Complex Builds**
   - Parallel work opportunities exist
   - Critical path needs management
   - Multiple integration points

5. **Error Prevention**
   - Mistakes have high cost
   - Rework is expensive
   - Prerequisites are strict

### ❌ Skip Dependencies When:

1. **Simple Tasks**
   - Single task or 2-3 independent tasks
   - No order requirements
   - Everything can happen in any sequence

2. **All Independent**
   - Tasks don't relate to each other
   - No shared dependencies
   - Parallel work throughout

3. **Quick Fixes**
   - Bug fixes
   - Small updates
   - One-off changes

### Decision Framework

```
Do you have multiple tasks?
└─ Yes
   └─ Do some tasks depend on others?
      └─ Yes
         └─ Is the order important?
            └─ Yes → USE DEPENDENCIES
            └─ No → Skip dependencies
      └─ No → Skip dependencies
└─ No → Skip dependencies
```

---

# Part 3: Practical Application

## Quick Start

### 1. Natural Language (Easiest)

Simply describe your tasks with dependencies in plain English:

```bash
claude -p "Build a blog:
1. Set up database
2. Create API (needs database)
3. Build frontend (needs API)
4. Add tests (needs everything)

Track with dependencies."
```

Claude automatically creates a task list with `blockedBy` fields.

### 2. View Your Tasks

Press `Ctrl+T` or ask:
```
"Show me all tasks"
```

### 3. Share Tasks Across Sessions

```bash
CLAUDE_CODE_TASK_LIST_ID=my-project claude
```

All sessions using `my-project` share the same task list.

---

## Context Management & Long-Running Projects

### Understanding Context Limits

Claude Code operates within approximately **200,000 tokens** of context. To put this in perspective:

**Token Usage Breakdown:**
- Reading a medium-sized file: ~5K-10K tokens
- Writing significant code: ~3K-8K tokens per implementation
- Conversation exchanges: ~1K-3K tokens each
- Tool outputs and results: ~1K-5K tokens each

**Real-World Impact:**
A complex project session might include:
- 20 file reads = 100K-200K tokens
- 10 code generations = 30K-80K tokens
- 30 conversation exchanges = 30K-90K tokens

**Result:** You can easily exceed the context window in a single intensive session working on a complex project.

### Task Lists as Context Anchors

The genius of Claude Code's task management system is that **task lists persist outside the context window**. Think of them as "save points" in a video game.

**What Persists Across Sessions:**

✅ **Task content** - Every task description
✅ **Task status** - pending, in_progress, completed
✅ **Dependencies** - All `blockedBy` relationships
✅ **Task history** - Complete record of what's been done
✅ **Task list ID** - Links sessions together

**What Doesn't Persist in Context:**

❌ **File contents** - Must be re-read in fresh sessions
❌ **Detailed implementation discussions** - Older conversations get summarized
❌ **Code in memory** - Code is saved to disk but not in active context
❌ **Architectural decisions** - Unless captured in task names or recent conversation

**Key Insight:** Task lists give you **continuity without context limits**. You can work on a project for days, weeks, or months by starting fresh sessions while maintaining perfect progress tracking.

### Multi-Day/Week Project Strategies

#### Pattern 1: Phased Development

Break your project into phases, with session boundaries at natural breakpoints.

```bash
# Day 1 - Foundation Phase
CLAUDE_CODE_TASK_LIST_ID=ecommerce-site claude
```

```text
"Create task breakdown for e-commerce site:

Phase 1 - Database & Auth:
1. Design database schema
2. Set up PostgreSQL
3. Create user authentication (needs: schema, PostgreSQL)
4. Implement JWT tokens (needs: authentication)

Phase 2 - Product Catalog:
5. Build product model (needs: Phase 1 complete)
6. Create product API (needs: product model)
7. Add product search (needs: product API)

Phase 3 - Shopping Cart:
8. Design cart schema (needs: Phase 1)
9. Build cart API (needs: cart schema, product API)
10. Add checkout flow (needs: cart API)

Track with dependencies. Complete Phase 1 today."
```

```bash
# Day 2 - Continue with fresh context
CLAUDE_CODE_TASK_LIST_ID=ecommerce-site claude
```

```text
"Show me all tasks. I want to continue with Phase 2."
```

**Benefits:**
- Each phase fits comfortably in one session
- Natural breakpoints for context refresh
- Clear progress milestones
- Easy to resume

#### Pattern 2: Context Refresh Strategy

For very long sessions or complex work, proactively refresh context before hitting limits.

**When to Refresh:**

Signs you're approaching context limits:
- Claude asks about things discussed earlier in the session
- Responses feel slower or less precise
- You've read 15-20+ files in one session
- You're starting a major new component/feature

**How to Refresh:**

```bash
# In current session:
"Show me all completed tasks"  # Verify progress is saved
Ctrl+T  # View task status

"I'm ending this session. Progress summary:
- Completed: Database setup, authentication system
- In Progress: Product API (50% done, GET endpoints work)
- Next: Finish POST/PUT/DELETE endpoints for products
- Decisions made: Using JWT with 7-day expiry, PostgreSQL for main DB
- Note: Product validation logic is in src/validators/product.js"

# Exit Claude Code

# Start fresh session:
CLAUDE_CODE_TASK_LIST_ID=ecommerce-site claude

# Resume work:
"Show all tasks and status. I want to continue where the last session left off.
 I was working on the Product API - GET endpoints are done, need to complete
POST/PUT/DELETE. Using JWT auth and product validation is in validators/."
```

**Pro Tip:** The more context you provide when resuming, the faster Claude can get back up to speed.

#### Pattern 3: Session Handoff Notes

Create explicit handoff notes at the end of each session for seamless continuation.

```text
# End of Session Handoff Template:
"Session ending. Handoff notes:

COMPLETED:
- [List completed tasks/features]

IN PROGRESS:
- [Current task]
- [What's done, what remains]
- [Any blockers or issues]

KEY DECISIONS:
- [Architecture choices made]
- [Technology selections]
- [Patterns established]

FILE LOCATIONS:
- [Important files and their purposes]

NEXT SESSION:
- [What to work on next]
- [Any context that will be important]

Save this for session resume."
```

**Resume Template:**

```text
"Show all tasks. Resume from previous session.

Last session notes:
[Paste handoff notes or summary]

I want to continue with [specific task or phase]."
```

### Automation Mode Control

Control how much autonomy Claude has while working through your task list.

#### Manual Mode - Maximum Control

**When to Use:**
- Learning a new technology or pattern
- Exploring architectural options
- Working on critical/sensitive code
- Want to review each step carefully

**How to Request:**

```text
"Create these tasks with dependencies:
[Your task list]

Work in MANUAL mode - wait for my explicit approval before starting each task."
```

**What Happens:**
- Claude presents the next unblocked task
- Explains what it will do
- Waits for your "yes" / "go ahead" / "approved"
- Completes the task
- Repeats for next task

**Example Flow:**

```text
Claude: "The next unblocked task is 'Set up database schema'. I'll create a
        PostgreSQL schema with users, products, and orders tables. Should I proceed?"
You: "Yes, but add a reviews table too"
Claude: [Implements with reviews table]
Claude: "Database schema complete. Next task is 'Create API routes'. Should I proceed?"
```

#### Semi-Auto Mode - Guided Automation (RECOMMENDED)

**When to Use:**
- Most real-world projects
- When you trust the implementation details but want input on big decisions
- Team collaboration where leads review architecture
- Production systems requiring oversight

**How to Request:**

```text
"Create these tasks with dependencies:
[Your task list]

Work through these automatically, but pause and ask me before:
- Major architectural decisions
- Adding new dependencies/libraries
- Changing existing APIs or contracts
- Deployment or production changes"
```

**What Happens:**
- Claude works through unblocked tasks automatically
- Implements straightforward tasks without asking
- Pauses when encountering decision points
- Asks for guidance on architecture/patterns
- Continues after getting input

**Example Flow:**

```text
Claude: [Completes database setup]
Claude: [Builds basic CRUD API]
Claude: "I'm about to implement authentication. I can use:
        1. JWT tokens (stateless, scales well)
        2. Session-based auth (simpler, but needs shared storage)
        3. OAuth2 with external provider

        Which approach fits your requirements?"
You: "JWT with 7-day expiry"
Claude: [Implements JWT authentication]
Claude: [Continues with remaining tasks]
```

#### Fully-Auto Mode - Hands-Off

**When to Use:**
- Well-defined requirements with clear patterns
- Repetitive implementations following established patterns
- Non-critical code or prototypes
- Time-constrained situations
- You fully trust Claude's judgment

**How to Request:**

```text
"Create these tasks with dependencies:
[Your task list]

Work through ALL tasks automatically using best practices. Complete the entire
list without stopping for questions. Only pause if you hit errors or blockers."
```

**What Happens:**
- Claude works through entire task list
- Makes all implementation decisions
- Follows best practices and common patterns
- Only stops for actual errors or impossible tasks
- Completes as much as possible autonomously

**Example Flow:**

```text
Claude: [Creates all tasks]
Claude: [Works through tasks 1-5]
Claude: [Implements features following best practices]
Claude: [Writes tests automatically]
Claude: [Completes entire workflow]
Claude: "All tasks completed. Summary:
        - Database schema created
        - API endpoints implemented
        - Frontend components built
        - Tests passing
        - Ready for review"
```

#### Switching Modes Mid-Project

You can change modes at any time:

```text
"Switch to manual mode for the next task - I want to review the implementation"

"This is going well, switch to fully-auto mode for the remaining tasks"

"Semi-auto mode from here - ask before major decisions"
```

#### Interrupting Automation

**You're always in control:**

- **Hit Ctrl+C** to interrupt current task
- Say "Stop" or "Pause" to halt execution
- Ask "Show me what you've done so far"
- Request "Wait before the next task"

### Long-Running Background Tasks

Some tasks take significant time (migrations, large builds, extensive testing). Use this pattern:

```bash
# Session 1 - Start long-running task
CLAUDE_CODE_TASK_LIST_ID=migration-project claude
```

```text
"Start database migration (this will take ~2 hours). Mark the task as complete
when done so other sessions can see it's ready. Monitor for errors."
```

```bash
# Session 2 - Check status while migration runs
CLAUDE_CODE_TASK_LIST_ID=migration-project claude
```

```text
"Show all tasks. Is the database migration complete? If so, I'll start
deploying the updated application."
```

**Benefits:**
- Don't wait idle while long tasks run
- Work on other things in parallel
- Multiple team members can check status
- Tasks update status when complete

### Collaborative Multi-Session Development

Multiple developers can work on the same project using shared task lists.

**Setup:**

```bash
# Team lead creates tasks
CLAUDE_CODE_TASK_LIST_ID=team-feature-x claude
```

```text
"Create task breakdown for feature X:

Backend:
1. API endpoints
2. Database queries
3. Business logic

Frontend:
4. UI components (needs: API endpoints)
5. State management (needs: API endpoints)
6. Integration tests (needs: UI components)

All team members will use task list 'team-feature-x'."
```

```bash
# Developer A
CLAUDE_CODE_TASK_LIST_ID=team-feature-x claude
"Show unblocked tasks. I'll work on the API endpoints."

# Developer B (different machine/time)
CLAUDE_CODE_TASK_LIST_ID=team-feature-x claude
"Show unblocked tasks. I'll work on the database queries."
```

**Benefits:**
- Clear work division
- No duplicate effort
- Automatic coordination via dependencies
- Everyone sees real-time progress

---

## How to Use: Step-by-Step

### Method 1: Ask Claude to Create Dependencies

**Step 1:** Describe your project with clear dependencies

```
"I need to build a user authentication system. Here are the steps:

1. Create user database table
2. Build registration API endpoint (needs database)
3. Build login API endpoint (needs database)
4. Create registration form (needs registration API)
5. Create login form (needs login API)
6. Write integration tests (needs both forms working)

Please create a task list with dependencies so we work in the right order."
```

**Step 2:** Claude creates the TodoWrite automatically

```
✅ Create user database table
🔧 Build registration API endpoint (blocked by: Create user database table)
⏸️ Build login API endpoint (blocked by: Create user database table)
⏸️ Create registration form (blocked by: Build registration API endpoint)
⏸️ Create login form (blocked by: Build login API endpoint)
⏸️ Write integration tests (blocked by: Create registration form, Create login form)
```

**Step 3:** Claude works on unblocked tasks first

Execution order:
1. Create user database table (no blockers)
2. Build both API endpoints in parallel (both unblocked after step 1)
3. Build both forms in parallel (both unblocked after step 2)
4. Run tests (after both forms complete)

### Method 2: Manually Create Task List

**Step 1:** Create your task list with dependencies

```json
{
  "todos": [
    {"content": "Write Dockerfile", "activeForm": "Writing Dockerfile", "status": "pending"},
    {"content": "Build Docker image", "activeForm": "Building Docker image", "status": "pending", "blockedBy": ["Write Dockerfile"]},
    {"content": "Run container locally", "activeForm": "Running container locally", "status": "pending", "blockedBy": ["Build Docker image"]},
    {"content": "Deploy to staging", "activeForm": "Deploying to staging", "status": "pending", "blockedBy": ["Run container locally"]}
  ]
}
```

**Step 2:** Tell Claude to work through the list

```
"I've created a task list. Please work through these tasks in dependency order,
marking each as complete before moving to the next."
```

**Step 3:** Claude executes in order

```
Dockerfile → Build Image → Run Locally → Deploy
```

### Method 3: Use Shared Task Lists

**Step 1:** Start a session with a task list ID

```bash
CLAUDE_CODE_TASK_LIST_ID=feature-auth claude
```

**Step 2:** Create your tasks

```
"Create tasks for building authentication:
1. Database schema
2. API endpoints (needs database)
3. Frontend forms (needs API)
Track with dependencies."
```

**Step 3:** In another terminal, join the same task list

```bash
CLAUDE_CODE_TASK_LIST_ID=feature-auth claude
```

**Step 4:** Both sessions share the same tasks

```
Session 1: "Show me all tasks"
Session 2: "Show me all tasks"  # Sees the same list
```

When Session 1 completes a task, Session 2 sees it updated.

---

## Common Patterns

(Content from original guide continues here with all the patterns: Linear Chain, Parallel Tasks, Diamond Pattern, Independent + Convergence)

---

## Advanced Usage

### Multi-Session Collaboration

**Scenario:** Team working on a large feature across multiple sessions.

**Setup:**
```bash
# Team member 1 - Creates tasks
CLAUDE_CODE_TASK_LIST_ID=feature-payments claude

> "Create task breakdown for payment integration:
> 1. Stripe API setup
> 2. Payment model & database
> 3. Payment controller (needs model)
> 4. Frontend payment form (needs controller)
> 5. Receipt email system (needs controller)
> 6. Tests (needs everything)
> Track with dependencies."

# Team member 2 - Sees same tasks
CLAUDE_CODE_TASK_LIST_ID=feature-payments claude

> "Show me all tasks"
> "Work on the unblocked frontend task"
```

### Conditional Dependencies

**Scenario:** Some tasks only needed if others fail or for specific environments.

```json
[
  {"content": "Run tests", "status": "completed"},
  {"content": "Fix failing tests", "status": "pending", "blockedBy": ["Run tests"]},
  {"content": "Deploy to staging", "status": "pending", "blockedBy": ["Fix failing tests"]},
  {"content": "Manual QA", "status": "pending", "blockedBy": ["Deploy to staging"]},
  {"content": "Deploy to production", "status": "pending", "blockedBy": ["Manual QA"]}
]
```

If tests pass on first run, skip "Fix failing tests" and proceed.

### Long-Running Background Tasks

```bash
# Start a long-running task in background
CLAUDE_CODE_TASK_LIST_ID=migration claude -p "Start database migration (this will take 2 hours). When done, mark the task complete so other sessions know it's ready."

# In another session, check status
CLAUDE_CODE_TASK_LIST_ID=migration claude
> "Show me all tasks and their status"
> "Is the database migration complete? If so, I'll start the API deployment."
```

### Complex Project Breakdown

```bash
claude -p "Break down building an e-commerce platform into tasks with dependencies:

Phase 1: Database & Auth
- User tables
- Product tables
- Order tables
- Authentication system (needs user tables)

Phase 2: Backend APIs
- User API (needs auth)
- Product catalog API (needs product tables)
- Shopping cart API (needs product & user APIs)
- Order processing API (needs cart & order tables)

Phase 3: Frontend
- User registration/login (needs auth API)
- Product browsing (needs catalog API)
- Shopping cart UI (needs cart API)
- Checkout flow (needs order API)

Phase 4: Testing & Deploy
- Unit tests (needs all APIs)
- Integration tests (needs frontend + backend)
- Deploy to staging (needs tests passing)
- Production deploy (needs staging validation)

Create a detailed task list with all dependencies mapped."
```

---

# Part 4: Real-World Implementation

## Multi-Session Collaboration

(Content continues with detailed examples and patterns)

## Team Workflows

(Content continues)

## Real-World Examples

### Example 1: E-Commerce Product Page

**Goal:** Build a new product detail page with reviews.

```bash
claude -p "Build a product detail page with these requirements:

1. Create product database schema (no dependencies)
2. Add review table to database (no dependencies)
3. Build product API endpoint (needs: product schema)
4. Build reviews API endpoint (needs: review table)
5. Create product detail React component (needs: product API)
6. Create reviews React component (needs: reviews API)
7. Integrate reviews into product page (needs: both components)
8. Add unit tests for components (needs: both components)
9. Add E2E tests (needs: integration complete)
10. Deploy to staging (needs: all tests passing)

Create task list with dependencies."
```

**Result:**
```
Execution Order:
1. Product schema + Review table (parallel)
2. Product API + Reviews API (parallel, after step 1)
3. Product component + Reviews component (parallel, after step 2)
4. Integrate reviews (after step 3)
5. Unit tests (after step 4)
6. E2E tests (after step 5)
7. Deploy (after step 6)
```

(More examples continue from original guide...)

---

# Part 5: Reference & Troubleshooting

## Best Practices

### ✅ DO:

1. **Use Clear, Descriptive Task Names**
   ```json
   ✅ {"content": "Create user authentication database table"}
   ❌ {"content": "DB stuff"}
   ```

2. **Keep Dependencies Explicit**
   ```json
   ✅ "blockedBy": ["Create database schema"]
   ❌ "blockedBy": ["database"]  // Too vague
   ```

3. **Break Large Tasks into Smaller Ones**
   ```json
   ✅
   - "Design API schema"
   - "Implement GET endpoints"
   - "Implement POST endpoints"

   ❌
   - "Build entire API"  // Too large
   ```

4. **Use Parallel Tasks When Possible**
   ```json
   // These can run in parallel:
   {"content": "Build frontend", "blockedBy": ["Setup project"]},
   {"content": "Build backend", "blockedBy": ["Setup project"]},
   // Then converge:
   {"content": "Integration tests", "blockedBy": ["Build frontend", "Build backend"]}
   ```

5. **Document Why Tasks are Blocked**
   ```json
   {"content": "Deploy to production (must pass security audit)",
    "blockedBy": ["Complete security audit"]}
   ```

### ❌ DON'T:

1. **Don't Create Circular Dependencies**
   ```json
   ❌
   {"content": "A", "blockedBy": ["B"]},
   {"content": "B", "blockedBy": ["A"]}
   // This creates a deadlock!
   ```

2. **Don't Use Ambiguous Task Names**
   ```json
   ❌
   {"content": "Tests", "status": "pending"},
   {"content": "More tests", "blockedBy": ["Tests"]}  // Which tests?
   ```

3. **Don't Mix Case in Task Names**
   ```json
   ❌
   {"content": "Setup database"},
   {"content": "Build API", "blockedBy": ["setup database"]}  // Case mismatch!
   ```

4. **Don't Create Unnecessary Dependencies**
   ```json
   ❌
   {"content": "Write README", "blockedBy": ["Deploy to production"]}
   // README doesn't actually depend on deployment
   ```

5. **Don't Make Every Task Sequential**
   ```json
   ❌ Everything in a chain when some could be parallel
   ✅ Identify truly independent tasks
   ```

### Context Window Best Practices

6. **Always Use Task List IDs for Non-Trivial Work**

   ```bash
   # Do this for any project with 3+ tasks
   CLAUDE_CODE_TASK_LIST_ID=project-name claude
   ```

   **Why:** Enables session continuity and team collaboration

7. **Break Work into Context-Sized Chunks**

   ```text
   ❌ "Migrate entire 50-file codebase to TypeScript"
   ✅ "Phase 1: Migrate models/ to TypeScript"
   ✅ "Phase 2: Migrate controllers/ to TypeScript"
   ✅ "Phase 3: Migrate services/ to TypeScript"
   ```

   **Why:** Each phase fits in one session with room for context

8. **Document Decisions in Task Names**

   ```text
   ❌ "Build user API"
   ✅ "Build user API using JWT authentication and PostgreSQL"
   ```

   **Why:** Important context persists across sessions in task names

9. **Plan for Session Boundaries**

   Natural breakpoints for context refresh:
   - After completing a phase
   - Before deployment or major milestones
   - When switching from backend to frontend
   - After 15-20 file reads in one session

   ```text
   End session: "Completed Phase 1: database layer. Next: API layer."
   New session: "Continue with Phase 2: API layer."
   ```

10. **Use Multiple Task Lists for Distinct Projects**

    ```bash
    # Keep projects separate
    CLAUDE_CODE_TASK_LIST_ID=feature-auth claude      # Auth work
    CLAUDE_CODE_TASK_LIST_ID=bugfix-payments claude  # Different project
    CLAUDE_CODE_TASK_LIST_ID=refactor-api claude     # Another project
    ```

    **Why:** Prevents task confusion, enables parallel work on different projects

11. **Capture Context in Handoff Notes**

    ```text
    "Session ending. Key context for next session:
    - Using JWT with 7-day expiry (decided after security review)
    - Product validation logic in src/validators/product.js
    - Database connection pooling set to max 20 connections
    - Next: Implement cart API endpoints"
    ```

    **Why:** Reduces ramp-up time in new sessions

12. **Refresh Context Proactively**

    Don't wait until you hit limits:
    - After 15+ file reads
    - Before starting a new major component
    - When switching architectural layers
    - If responses feel less precise

    ```bash
    # Save progress and refresh
    Ctrl+T  # Check tasks saved
    # Exit and restart with same task ID
    CLAUDE_CODE_TASK_LIST_ID=same-id claude
    ```

---

## Troubleshooting Guide

### Problem: Task Isn't Unblocking

**Symptom:**
```
✅ Task A (completed)
⏸️ Task B (still blocked by: Task A)
```

**Solution:** Check exact string matching:
```json
// Wrong:
{"content": "Task A", "status": "completed"}
{"content": "Task B", "blockedBy": ["task a"]}  // Lowercase!

// Right:
{"content": "Task A", "status": "completed"}
{"content": "Task B", "blockedBy": ["Task A"]}  // Exact match
```

### Problem: Claude Isn't Respecting Dependencies

**Symptom:** Claude starts a blocked task before its dependencies.

**Solution:** Be explicit in your instructions:
```
"Work on these tasks in dependency order. Only start a task when all its blockers are complete."
```

### Problem: Can't Find Task List Across Sessions

**Symptom:** Second session doesn't see tasks from first session.

**Solution:** Ensure same task list ID:
```bash
# Session 1
CLAUDE_CODE_TASK_LIST_ID=my-project claude

# Session 2 (must use same ID)
CLAUDE_CODE_TASK_LIST_ID=my-project claude
```

### Problem: Too Many Tasks, Hard to Track

**Symptom:** 20+ tasks, unclear what's ready.

**Solution:** Ask Claude to filter:
```
"Show me only the tasks that are currently unblocked and ready to work on"
```

### Problem: Circular Dependency Created

**Symptom:**
```
Task A blocks Task B
Task B blocks Task A
Nothing can start!
```

**Solution:**
```
"Analyze my task list for circular dependencies and fix them"
```

### Problem: Lost Track of Dependencies

**Symptom:** Not sure which tasks depend on what.

**Solution:**
```
"Create a visual dependency graph of all my tasks"
"For each pending task, tell me what it's waiting for and why"
```

### Problem: Claude Seems to Have Forgotten Earlier Context

**Symptom:** Claude asks about things discussed earlier in the session, seems to lose track of previous decisions or implementations.

**Cause:** Context window has filled up with conversation history, file reads, and code generation.

**Solution - Method 1: Verify Progress and Refresh**

```bash
# 1. In current session, verify tasks are saved
Ctrl+T  # View all tasks and their status

"Show me all completed tasks to verify progress is saved"

# 2. Create handoff notes
"I'm ending this session. Progress summary:
- Completed: [list completed work]
- In Progress: [current task and status]
- Key Decisions: [architecture choices, patterns established]
- Important Files: [list key files and their purposes]
- Next Steps: [what to work on next]"

# 3. Exit Claude Code and restart
CLAUDE_CODE_TASK_LIST_ID=same-project-id claude

# 4. Resume with context
"Show all tasks. I want to continue from the previous session.
Here's where we were: [paste key points from handoff notes]"
```

**Solution - Method 2: Quick Context Refresh**

```bash
# If you just need a quick refresh mid-project:
"Let's pause here. Show me:
1. All completed tasks
2. Current task in progress
3. Next 3 unblocked tasks

Then I'll restart the session and we'll continue."

# Exit and restart with same task ID
CLAUDE_CODE_TASK_LIST_ID=same-id claude

"Continue from previous session. Show task status and let's resume."
```

**Prevention:** Proactively refresh context after:
- Reading 15-20+ files
- Before starting a new major component
- When switching from one layer/module to another
- After 1-2 hours of intensive work

### Problem: Not Sure How Much Context Remains

**Symptom:** Worried about hitting context limits mid-task, uncertain when to refresh.

**Solution - Use Task-Based Context Planning:**

```text
"I'm working on a large project. Let's break it into phases that fit in
single sessions:

Phase 1: Database layer (should be 5-8 tasks, fits in one session)
Phase 2: API layer (8-10 tasks, separate session)
Phase 3: Frontend (10-12 tasks, separate session)
Phase 4: Testing (5-8 tasks, final session)

Create tasks with this phasing. I'll complete one phase per session and
refresh context between phases."
```

**Solution - Monitor Context Usage:**

Signs you're approaching limits:
- Claude's responses feel less precise
- Repeated questions about earlier decisions
- Slower response times
- Claude suggests reviewing files already discussed

**When you see these signs:**

```bash
# Save and refresh immediately
"Show completed tasks. I'm going to refresh the session."
# Exit and restart with same task ID
```

**Best Practice:** Plan to refresh every 15-20 file reads or 2 hours of work

### Problem: Multi-Day Project - Forgot Where We Left Off

**Symptom:** Returning to a project after a day/week, unclear what was decided or what state things are in.

**Solution - Use Handoff Template:**

```text
# At end of each session:
"Create handoff notes for next session:

## Session [Date] Summary

### Completed Tasks:
- [List with key details]

### In Progress:
- Task: [name]
- Status: [what's done, what remains]
- Location: [files being worked on]

### Key Decisions Made:
- [Architecture choices]
- [Technology selections]
- [Patterns established]

### Important Context:
- [File locations and purposes]
- [Configuration details]
- [Any gotchas or special considerations]

### Next Session Should:
- [Specific next steps]
- [Files that will need attention]

Save these notes - I'll need them when I return."
```

**Resuming:**

```bash
CLAUDE_CODE_TASK_LIST_ID=project-name claude
```

```text
"Show all tasks. I'm returning to this project. Here are the handoff notes
from last session:

[Paste handoff notes]

I want to continue where we left off. What should we work on next?"
```

### Problem: Working on Multiple Projects Simultaneously

**Symptom:** Tasks from different projects getting mixed up, losing track of which project is which.

**Solution - Use Separate Task List IDs:**

```bash
# Create project-specific aliases
alias claude-auth="CLAUDE_CODE_TASK_LIST_ID=feature-auth claude"
alias claude-payments="CLAUDE_CODE_TASK_LIST_ID=feature-payments claude"
alias claude-refactor="CLAUDE_CODE_TASK_LIST_ID=refactor-api claude"

# Then use project-specific commands
claude-auth     # Work on auth feature
claude-payments # Switch to payments feature
claude-refactor # Work on refactoring
```

**Benefits:**
- Complete isolation between projects
- Can switch projects instantly
- Each project maintains its own context and progress
- No task confusion or conflicts

### Problem: Session Interrupted Unexpectedly

**Symptom:** Claude Code crashed, terminal closed, or session ended abruptly without saving handoff notes.

**Solution - Tasks Still Persist:**

```bash
# Restart with same task ID
CLAUDE_CODE_TASK_LIST_ID=your-project claude
```

```text
"Show all tasks and their status. My previous session ended unexpectedly.
Looking at the task status, what was I working on? Help me understand
where we left off so I can continue."
```

**Claude will:**
- Show completed tasks (these definitely finished)
- Show in_progress task (may be partially done)
- Help reconstruct recent work based on task history

**Then:**

```text
"Let me check the files to see what state they're in:
[Read relevant files to verify completion status]

Okay, it looks like [summary of what was done]. Let's continue with [next task]."
```

**Prevention - Quick Save Habit:**

```text
# Periodically during long sessions:
"Quick progress check - show completed tasks"

# This ensures task status is written to disk
```

---

## Complete Syntax Reference

### TodoWrite Schema

```json
{
  "todos": [
    {
      "content": "string",          // Required: Task name (imperative)
      "activeForm": "string",        // Required: Task name (continuous)
      "status": "enum",              // Required: "pending" | "in_progress" | "completed"
      "blockedBy": ["string"]        // Optional: Array of blocking task names
    }
  ]
}
```

### Task Statuses

- `pending` - Not started, may be blocked
- `in_progress` - Currently working on
- `completed` - Finished

### Commands

```bash
# View tasks
Ctrl+T                          # Toggle task view
"Show me all tasks"             # List all
"Show unblocked tasks"          # Show ready tasks

# Manage tasks
"Clear all tasks"               # Clear task list
"Remove completed tasks"        # Clean up finished

# Shared tasks
CLAUDE_CODE_TASK_LIST_ID=name claude  # Use named list
```

### Environment Variables

```bash
CLAUDE_CODE_TASK_LIST_ID=project-name    # Shared task list ID
```

---

## Additional Resources

### Official Documentation
- [Claude Code Release Notes v2.1.16](https://github.com/anthropics/claude-code/releases/tag/v2.1.16)
- [Claude Agent SDK - Todo Tracking](https://platform.claude.com/docs/en/agent-sdk/todo-tracking)
- [Interactive Mode Documentation](https://code.claude.com/docs/en/interactive-mode)

### Community Tools
- [simensen/claude-ai-dev-tasks](https://github.com/simensen/claude-ai-dev-tasks) - Markdown-based task system
- [dean0x/claudine](https://github.com/dean0x/claudine) - DAG-based CLI tool
- [JeremyKalmus/parade](https://github.com/JeremyKalmus/parade) - Visual workflow manager

---

## Changelog

**v2.1.16 (January 22, 2026)**
- Initial release of task dependency tracking
- Added `blockedBy` field to TodoWrite
- Added `CLAUDE_CODE_TASK_LIST_ID` for shared task lists

**Documentation v2.0.0 (January 23, 2026)**
- Restructured as "Task Management" guide
- Added comprehensive fundamentals section
- Expanded dependencies coverage
- Improved organization and navigation

---

**Happy Building! 🚀**

For quick reference, see [quick-reference.md](quick-reference.md)
For copy-paste examples, see [examples.md](examples.md)
