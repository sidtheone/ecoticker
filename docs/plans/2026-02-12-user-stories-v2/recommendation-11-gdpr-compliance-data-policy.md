# Recommendation #11: GDPR Compliance & Data Policy

> Launching in the EU means GDPR applies from day one. This is not optional — it's a legal requirement. Article 13 requires transparent disclosure of data processing. Article 5(1)(c) requires data minimization.

## US-11.1: Display a GDPR-compliant data policy page
**As a** European visitor, **I want** to understand what data EcoTicker collects and how it's used, **so that** I can trust the service and exercise my rights under GDPR.

**Why this is a launch blocker:**
EcoTicker launches in Europe. Under GDPR, any service accessible to EU residents must:
1. Disclose what personal data is collected (Article 13)
2. State the legal basis for processing (Article 6)
3. Explain retention periods (Article 13(2)(a))
4. Provide contact information for the data controller (Article 13(1)(a))
5. Inform users of their rights (access, deletion, portability — Articles 15-20)

Without this page, operating in the EU is a legal liability.

**What personal data does EcoTicker actually collect?**
After the GDPR audit, very little:
- **Truncated IP addresses** in audit_logs and score_feedback — last octet zeroed, not reversible to individuals. Legal basis: legitimate interest (abuse prevention).
- **No cookies** (theme preference uses localStorage, not cookies — no cookie banner needed).
- **No user accounts** — no email, no name, no password.
- **No tracking pixels** — no Google Analytics, no Meta Pixel, no third-party trackers.
- **No fingerprinting** — user_agent removed from audit_logs.
- **Page view counts** — aggregated daily per topic, no individual identification.

**This is a strong privacy story.** Most competing sites collect far more. The data policy page should communicate this clearly — privacy-by-design is a competitive advantage, not just compliance.

**Acceptance Criteria:**

**Data Policy page (`/data-policy`):**
- Static page (server component, no client JS needed)
- Sections (following GDPR Article 13 structure):

  1. **What We Collect** — plain-language table:
     | Data | Where | Why | Retained |
     |------|-------|-----|----------|
     | Truncated IP addresses | Audit logs, feedback reports | Abuse prevention | 90 days |
     | Page view counts | Topic analytics | Understanding which topics matter | Indefinite (no PII) |
     | Feedback text | Score feedback form | Improving scoring accuracy | Indefinite (no PII) |
     | Theme preference | Your browser (localStorage) | Remembering light/dark mode | Until you clear browser data |

  2. **What We Don't Collect** — explicitly state:
     - No cookies (no cookie banner needed)
     - No user accounts or personal profiles
     - No email addresses
     - No tracking pixels or third-party analytics
     - No browser fingerprinting
     - No data sold to third parties

  3. **Legal Basis** — Legitimate interest (Article 6(1)(f)) for truncated IP storage (abuse prevention). No consent required because IPs are truncated and not individually identifiable.

  4. **Your Rights** — Under GDPR, you have the right to:
     - Access your data (Article 15)
     - Request deletion (Article 17)
     - Object to processing (Article 21)
     - Since we store no individually-identifiable data, there is typically nothing to access or delete. Contact us if you have questions.

  5. **Data Retention** — Audit logs auto-purged after 90 days. Aggregated analytics retained indefinitely (not PII). Score feedback retained indefinitely (not individually identifiable).

  6. **Data Controller** — Contact information (email address for privacy inquiries). Required by Article 13(1)(a).

  7. **Changes to This Policy** — "We'll update this page if our practices change. Last updated: [date]."

- SEO: proper `<title>`: "Data Policy | EcoTicker", `<meta description>`
- Linked from: site footer (persistent across all pages), scoring methodology page (US-2.2)
- Language: plain English, not legalese. GDPR requires information to be "concise, transparent, intelligible and in easily accessible form, using clear and plain language" (Article 12(1)).

**What this story does NOT include:**
- Cookie consent banner — not needed (no cookies used)
- DPIA (Data Protection Impact Assessment) — not required (no high-risk processing, no profiling, no large-scale systematic monitoring)
- DPO (Data Protection Officer) — not required (not a public authority, no large-scale processing of sensitive data)

**Complexity:** S (static content page + footer link)
**Dependencies:** None (can ship in any phase, but should be ready at launch)
**Blocks:** Nothing

---

## GDPR: Schema & Code Changes (bundled into Phase 0)

These are NOT a separate user story — they're engineering tasks inside Phase 0:

1. **Remove `audit_logs.user_agent` column** — not needed, PII risk
2. **Truncate IP addresses before storage** — utility function:
   ```typescript
   function truncateIp(ip: string): string {
     if (ip.includes(":")) {
       // IPv6: zero last 80 bits (keep /48 prefix)
       return ip.replace(/:[\da-f]*:[\da-f]*:[\da-f]*:[\da-f]*:[\da-f]*$/i, "::0");
     }
     // IPv4: zero last octet
     return ip.replace(/\.\d+$/, ".0");
   }
   ```
3. **Apply truncation** in `audit-log.ts` (`logSuccess`, `logFailure`) and score feedback endpoint
4. **Add 90-day auto-purge** for audit_logs — run in batch pipeline or as separate cron step:
   ```sql
   DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '90 days'
   ```
5. **Add footer link** to `/data-policy` in root layout

---
