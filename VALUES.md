# EcoTicker — Values

Built with [InsightsLoop](https://github.com/sidtheone/insightsloop). Product values are EcoTicker's. Engineering, UX, and Security values are the engine's.

---

## Product Values

**"The data hurts. That's the point."**
EcoTicker doesn't comfort. It shows what's actually happening — scores, trends, declines. If the first view doesn't make you uncomfortable, the design failed.

**"Insight, not information."**
Raw data is noise. Every number on screen has been scored, contextualized, and reduced to something you can act on. If it doesn't change how you think, it doesn't belong.

**"Nothing decorative."**
No green gradients, no leaf icons, no eco-aesthetic. The content is the interface. Anything that isn't data or insight is visual noise.

---

## Engineering Values

**"Three lines beat a clever abstraction."**
Duplication is cheaper than the wrong abstraction. No premature DRY, no "just in case" layers. If you can read it top to bottom, it's good code.
*Serves: "Insight, not information."*

**"Read it top to bottom or rewrite it."**
If the next developer can't understand the code by reading it linearly, the engine pushes back. Readability is the primary quality metric.
*Serves: "Nothing decorative."*

**"Delete before you add."**
Every line earns its place. The engine challenges new complexity — if you can't justify it against the product values, it gets cut.
*Serves: "Nothing decorative."*

**"Untested code doesn't leave the engine."**
If there's no test, it doesn't ship. The engine enforces this — not as a suggestion, as a gate.
*Serves: "The data hurts. That's the point."*

---

## UX Values

**"Useful on first load."**
Every screen works immediately. No onboarding flows, no empty states that say "add your first thing." If the user has to figure it out, the design failed.
*Serves: "The data hurts. That's the point."*

**"Content over chrome."**
No decorative elements, no visual noise. Every pixel serves the user's task. The engine pushes back on UI that looks good but doesn't do anything.
*Serves: "Nothing decorative."*

**"Subtract until it breaks, then add one back."**
Design by removal. The engine challenges every element — if it survives the cut, it stays. Minimalism isn't a style, it's the process.
*Serves: "Insight, not information."*

---

## Security Values

**"Validate at the door."**
Every external input — user input, API responses, file uploads — validated at the boundary. Trust nothing from outside.
*Serves: "The data hurts. That's the point."*

**"No secrets in code. Ever."**
The engine flags hardcoded credentials, API keys, tokens. If it's sensitive, it goes in environment variables. No exceptions, no "I'll fix it later."
*Serves: "Insight, not information."*

**"Default closed."**
Every route, endpoint, and resource starts locked. You open access explicitly and intentionally. The engine won't let you ship open-by-default.
*Serves: "Nothing decorative."*

---

## What these values kill

| Value | Layer | What it prevents |
|:---|:---|:---|
| "The data hurts. That's the point." | Product | Feel-good dashboards, softened language, hiding bad scores |
| "Insight, not information." | Product | Raw data dumps, unscored articles, numbers without context |
| "Nothing decorative." | Product | Leaf icons, green gradients, eco-aesthetic, visual filler |
| "Three lines beat a clever abstraction." | Engineering | Utility libraries, base classes, "framework-ifying" simple code |
| "Read it top to bottom or rewrite it." | Engineering | Clever one-liners, deeply nested logic, magic |
| "Delete before you add." | Engineering | Dead code, unused imports, "might need this later" |
| "Untested code doesn't leave the engine." | Engineering | Shipping without coverage, "I'll add tests later" |
| "Useful on first load." | UX | Onboarding wizards, empty states, tutorial overlays |
| "Content over chrome." | UX | Decorative gradients, animations that don't inform, visual bloat |
| "Subtract until it breaks, then add one back." | UX | Feature-packed screens, "while we're at it" UI additions |
| "Validate at the door." | Security | Trusting client-side validation, unvalidated API responses |
| "No secrets in code. Ever." | Security | Hardcoded keys, committed .env files, "temporary" credentials |
| "Default closed." | Security | Open endpoints, permissive CORS, public-by-default resources |
