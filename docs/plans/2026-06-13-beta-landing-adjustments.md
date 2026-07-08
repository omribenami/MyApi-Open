# Beta Landing Page Messaging Refresh Implementation Plan

> **For Hermes:** Execute this plan directly in a clean worktree and push only the intended landing-page + plan changes.

**Goal:** Keep the repositioned landing page, but make the messaging clearly beta-aware so it does not read like finalized GA pricing or packaging.

**Architecture:** Update the static marketing landing page in `src/public/landing/index.html` and add a lightweight implementation plan artifact under `docs/plans/`. Preserve the new scoped-token positioning while changing the pricing/CTA surface into a beta access surface.

**Tech Stack:** Static HTML, inline CSS, inline JavaScript-generated sections.

---

### Task 1: Audit beta-risky copy
**Objective:** Identify copy that overstates packaging certainty during beta.

**Files:**
- Modify: `src/public/landing/index.html`
- Create: `docs/plans/2026-06-13-beta-landing-adjustments.md`

**Steps:**
1. Check hero CTA, pricing nav, pricing title, and future-plan card copy.
2. Preserve the new core positioning around user context/control and scoped token bootstrapping.
3. Mark pricing/package details as exploratory beta messaging, not fixed commercial plans.

### Task 2: Replace pricing with beta access framing
**Objective:** Turn the pricing section into a beta-friendly access/roadmap section.

**Files:**
- Modify: `src/public/landing/index.html`

**Steps:**
1. Rename the section from pricing to beta access.
2. Replace future paid-plan cards with beta-program cards.
3. Keep one clear CTA to join the beta.

### Task 3: Tighten beta CTAs and trust signals
**Objective:** Align hero/final CTA language with current stage.

**Files:**
- Modify: `src/public/landing/index.html`

**Steps:**
1. Change “Start free” / “Build your first helper” to beta-appropriate CTAs.
2. Keep the scoped-token / role-aware-helper thesis intact.
3. Add explicit notes that pricing and packaging are refined during beta.

### Task 4: Verify and ship safely
**Objective:** Validate syntax and push only the intended files.

**Files:**
- Modify: `src/public/landing/index.html`
- Create: `docs/plans/2026-06-13-beta-landing-adjustments.md`

**Steps:**
1. Parse the HTML with Python’s `html.parser`.
2. Review `git diff --stat` and `git diff`.
3. Commit only the landing page and the plan artifact.
