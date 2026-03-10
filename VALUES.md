# Our Values

Timeless principles that guide how we build, think, and ship together.

---

## Simplicity & Design

**"Simplicity is prerequisite for reliability."**
— Edsger W. Dijkstra
You cannot reason about, test, or trust what you cannot understand.

**"You Aren't Gonna Need It" (YAGNI)**
— Ron Jeffries / Extreme Programming
Building for imagined future requirements adds complexity now and the future rarely arrives as predicted.

**"Make each program do one thing well."**
— Doug McIlroy (Unix Philosophy)
Small, focused tools composed together are more powerful and durable than monoliths.

**"There are two ways of constructing a software design: one way is to make it so simple that there are obviously no deficiencies, and the other way is to make it so complicated that there are no obvious deficiencies."**
— C.A.R. Hoare
The first way is harder and worth it.

**"The best code is no code at all."**
— Jeff Atwood
Every line you write is a line you must maintain, debug, and explain. Delete what you can.

---

## Code Quality & Craftsmanship

**"Programs must be written for people to read, and only incidentally for machines to execute."**
— Harold Abelson & Gerald Jay Sussman (SICP)
Readability is not a luxury; it is the primary measure of code quality.

**"Any fool can write code that a computer can understand. Good programmers write code that humans can understand."**
— Martin Fowler
The audience for your code is the next developer, who is often future-you.

**"There are only two hard things in Computer Science: cache invalidation and naming things."**
— Phil Karlton
Good names eliminate the need for comments; bad names generate bugs.

**"Leave the campground cleaner than you found it." (The Boy Scout Rule)**
— Robert C. Martin
Codebases decay without continuous small improvements. Refactor as you go.

**"Duplication is far cheaper than the wrong abstraction."**
— Sandi Metz
Premature DRY leads to tangled abstractions. Tolerate repetition until the pattern is clear.

---

## Architecture

**"All problems in computer science can be solved by another level of indirection, except for the problem of too many levels of indirection."**
— David Wheeler (corollary by Kevlin Henney)
Abstraction is a tool, not a goal. Every layer has a cost.

**"Depend on abstractions, not concretions." (Dependency Inversion Principle)**
— Robert C. Martin
High-level policy should not break when low-level details change.

**"A system's design mirrors the communication structure of the organization that built it." (Conway's Law)**
— Melvin Conway
You cannot ship a clean architecture from a dysfunctional org chart. Design the teams, not just the code.

**"Gather together the things that change for the same reasons. Separate those that change for different reasons."**
— Robert C. Martin (restating Dijkstra)
Cohesion within a module, loose coupling between modules — this is the entire game.

**"Make it work, make it right, make it fast."**
— Kent Beck
Correctness before cleanliness, cleanliness before performance. In that order.

---

## Debugging & Problem Solving

**"Debugging is twice as hard as writing the code in the first place. Therefore, if you write the code as cleverly as possible, you are, by definition, not smart enough to debug it."**
— Brian Kernighan
A direct argument against cleverness. Write dumb, obvious code.

**"When you hear hoofbeats, think horses, not zebras."**
— Medical aphorism, applied to engineering
The bug is almost always in your code, not the compiler or the OS. Check the obvious first.

**"The most effective debugging tool is still careful thought, coupled with judiciously placed print statements."**
— Brian Kernighan
Sophisticated tools help, but nothing replaces understanding the system you built.

**"If it hurts, do it more frequently, and bring the pain forward."**
— Jez Humble / Martin Fowler
Painful deploys, painful merges, painful tests — make them routine and they become trivial.

---

## Teamwork & Communication

**"What one programmer can do in one month, two programmers can do in two months."**
— Fred Brooks (The Mythical Man-Month)
Adding people to a late project makes it later. Communication overhead grows quadratically.

**"Always code as if the person who ends up maintaining your code is a violent psychopath who knows where you live."**
— John Woods
Empathy for the reader is a professional obligation, not a nicety.

**"The purpose of software engineering is to control complexity, not to create it."**
— Pamela Zave
If your process or architecture makes things harder to understand, it is failing at its only job.

---

## Shipping & Pragmatism

**"Perfect is the enemy of good."**
— Voltaire
Ship the working version. Improve it with real feedback, not hypothetical requirements.

**"Plan to throw one away; you will, anyhow."**
— Fred Brooks (The Mythical Man-Month)
Your first attempt teaches you what the problem actually is. Build the second one on purpose.

**"Premature optimization is the root of all evil."**
— Donald Knuth
Measure first. Optimize the bottleneck. Everything else is wasted effort and added complexity.

**"Weeks of coding can save you hours of planning."**
— Unknown
A small amount of upfront thinking prevents enormous rework. Sketch before you build.

**"Ship it and iterate."**
— Reid Hoffman ("If you are not embarrassed by the first version of your product, you've launched too late.")
Real users teach you more in a day than a whiteboard teaches you in a month.

---

## Integrity — Verify Before You Assert

**"If you can't link it, don't claim it."**
— EcoTicker Values
Every factual claim needs a source you can point to. Confidence without evidence is just noise.

**"I don't know" is a valid answer.**
— EcoTicker Values
Gaps in knowledge aren't weaknesses — they're guardrails. Filling them with plausible-sounding guesses is how you lose trust.

**"It is wrong always, everywhere, and for anyone, to believe anything upon insufficient evidence."**
— W.K. Clifford
Applies to code reviews, architecture docs, comparison tables, and everything you publish with your name on it.

---

## Assumptions — Never Assume

**"The sea is calm does not mean the sea is safe."**
— Traditional maritime proverb
Even when conditions appear benign, assuming the absence of danger has cost countless lives.

**"Trust the compass, not the current."**
— Old sailor's wisdom
Currents can deceive you into thinking you're on course; assumptions about direction without checking instruments lead ships astray.

**"Red sky at night, sailor's delight; red sky in morning, sailor's warning."**
— Traditional (referenced in Matthew 16:2-3)
Never assume tomorrow's weather from today's comfort — observation and pattern recognition replace assumption.

**"The most dangerous phrase in the language is 'We've always done it this way.'"**
— Grace Hopper (Rear Admiral, USN & computer science pioneer)
Assuming past practice equals correct practice is the enemy of progress in both naval operations and software.

**"It works on my machine."**
— Universal software engineering proverb
The quintessential dangerous assumption — that local success guarantees production success.
