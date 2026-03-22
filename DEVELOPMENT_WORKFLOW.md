# MyApi Development Workflow
**Established:** 2026-03-22 15:35 CDT  
**Model:** Haiku (Dev) → Opus 4.6 (Review) → QA (Automated + Manual)

---

## Overview

All feature development follows a structured 4-stage process to ensure quality, maintainability, and correctness.

```
DEV (Haiku)
    ↓
CODE REVIEW (Opus 4.6)
    ↓
QA (Automated + Manual)
    ↓
SIGN-OFF & MERGE
```

---

## Stage 1: Development (Haiku)

**Responsibility:** Implement feature, write tests, commit code

### Process
1. **Create feature branch** (or work directly on main with clear commits)
2. **Implement** the feature/fix
3. **Write tests** (unit + integration where applicable)
4. **Build & verify** (npm run build, no errors)
5. **Commit** with descriptive message:
   ```
   feat(area): short description
   
   Detailed explanation:
   - What changed
   - Why it changed
   - How it works
   ```
6. **Push to GitHub** (main branch)
7. **Request review** from Opus 4.6 reviewer

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** feat, fix, refactor, test, docs, chore  
**Scope:** area/component being changed  
**Subject:** imperative, lowercase, no period  
**Body:** detailed explanation (optional)  
**Footer:** breaking changes, related issues (optional)

---

## Stage 2: Code Review (Opus 4.6)

**Responsibility:** Quality assurance, architecture review, best practices

### Review Checklist
- [ ] Code follows project conventions
- [ ] No breaking changes without documentation
- [ ] Tests are comprehensive and pass
- [ ] No hardcoded secrets or credentials
- [ ] Error handling is proper
- [ ] Performance implications considered
- [ ] Database migrations (if applicable) safe
- [ ] Comments/docs clear for maintainability
- [ ] Follows security best practices
- [ ] Architecture matches project patterns

### Review Output
- **APPROVE** ✅ - Code is ready for QA
- **REQUEST CHANGES** ⚠️ - Issues found, requires revision
- **COMMENT** 💬 - Questions/suggestions (doesn't block)

### Reviewer Role
- Catch bugs/issues before QA
- Ensure maintainability
- Coach on best practices
- Verify against architectural standards

---

## Stage 3: QA (Automated + Manual)

**Responsibility:** Test functionality, catch regressions, verify user experience

### 3a: Automated QA
```bash
# Run test suite
npm test

# Build verification
npm run build

# No errors/warnings threshold
```

### 3b: Manual QA
1. **Functional Testing**
   - Test primary use cases
   - Test edge cases
   - Test error scenarios

2. **Regression Testing**
   - Verify related features still work
   - Check for side effects

3. **User Experience**
   - UI/UX feels right
   - Performance acceptable
   - Mobile-responsive (if applicable)

4. **Browser/Environment**
   - Chrome/Firefox/Safari
   - Mobile (iOS/Android if web app)
   - Different network speeds

### QA Report
- ✅ **PASS** - All tests pass, no issues
- ⚠️ **PASS WITH NOTES** - Works but has minor issues
- ❌ **FAIL** - Issues found, back to Dev

---

## Stage 4: Sign-Off & Merge

**Criteria for Merge:**
- ✅ Dev complete
- ✅ Review approved
- ✅ QA passed
- ✅ All tests green
- ✅ Documentation updated
- ✅ Commit history clean

**Post-Merge:**
- Deploy to production (if applicable)
- Update PROJECT_STATUS.md
- Close related issues
- Communicate completion

---

## Workflow in Practice

### Example: Phase 5 Feature

**Phase 5: Encryption**

```
Day 1: DEV (Haiku)
├─ 09:00 - Start implementation
├─ 12:00 - Unit tests written
├─ 14:00 - Integration tests pass
├─ 15:00 - Build successful
├─ 15:30 - Commit & push
└─ 15:45 - Request review from Opus

Day 1: REVIEW (Opus 4.6)
├─ 16:00 - Start code review
├─ 16:30 - Questions/comments
├─ 17:00 - Approve & sign off
└─ 17:15 - Forward to QA

Day 2: QA (Automated)
├─ 09:00 - Run full test suite
├─ 09:15 - Run build verification
├─ 09:30 - All green ✅
└─ 09:45 - Manual QA starts

Day 2: QA (Manual)
├─ 10:00 - Functional testing
├─ 11:00 - Regression testing
├─ 12:00 - UX/performance check
├─ 13:00 - Final report
└─ 13:30 - APPROVED ✅

Day 2: MERGE & SIGN-OFF
├─ 14:00 - Merge to main
├─ 14:15 - Update documentation
└─ 14:30 - Phase 5 COMPLETE
```

---

## Tools & Commands

### Development
```bash
# Build
npm run build

# Test
npm test

# Git
git add -A
git commit -m "feat(area): description"
git push origin main
```

### Code Review Checklist
- [ ] Security review (no secrets)
- [ ] Architecture review (patterns followed)
- [ ] Test coverage (>80% for critical paths)
- [ ] Documentation (updated if needed)
- [ ] Performance (no regressions)

### QA Testing
```bash
# Automated
npm test
npm run build

# Manual
# - Load dashboard
# - Test user flows
# - Check console for errors
# - Verify mobile responsiveness
```

---

## Escalation Process

**If issues found at any stage:**

1. **QA finds issue** → Report to Dev
2. **Dev fixes** → Resubmit to Review
3. **Review finds issue** → Request changes from Dev
4. **Dev fixes** → Resubmit to Review
5. **Continue until approved**

---

## Review SLA

- **Dev → Review:** Same day (within 8 hours)
- **Review → QA:** Same day (within 2 hours of approval)
- **QA → Sign-Off:** Next day (within 24 hours)

---

## Documentation Standards

Each phase/feature should include:

1. **Technical Spec** (what + why + how)
2. **Architecture Diagram** (if complex)
3. **API Documentation** (if new endpoints)
4. **Test Coverage Report** (% and what tested)
5. **Known Limitations** (if any)
6. **Future Work** (follow-up phases)

---

**Effective Date:** 2026-03-22  
**Last Updated:** 2026-03-22  
**Owner:** Dev Team (Bugs, Opus 4.6 Reviewer, QA Lead)
