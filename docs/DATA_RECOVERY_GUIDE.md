# MyApi Data Recovery Guide

**Date:** March 26, 2026  
**Incident:** Database corruption + schema gaps led to data loss  
**Status:** RECOVERY IN PROGRESS  

---

## What Happened

On **Mar 17, 2026**, the database became corrupted, causing loss of:
- ✅ 9+ OAuth service connections (Google, GitHub, etc.)
- ✅ Custom skills and workflows
- ✅ Knowledge base documents
- ✅ Some persona customizations

**Root Causes:**
1. Database corruption event (cause: unknown, possibly failed migration)
2. Missing `knowledge_base` table in schema (architectural gap)
3. No automated backup + recovery strategy
4. Database recreated without data restoration

---

## Fixes Applied (Mar 26)

### ✅ Schema Fixes
- [x] Created `knowledge_base` table (was completely missing)
- [x] Added proper indexes for fast queries
- [x] Verified schema integrity

### ✅ Security Fixes
- [x] Removed sensitive context exposure from `/gateway/context`
- [x] Removed master token from `/auth/me`
- [x] Implemented proper logout token revocation

### ⏳ Still To Do
- [ ] Re-connect OAuth services
- [ ] Re-upload skills and KB documents
- [ ] Implement automated backup strategy
- [ ] Complete Phase 3 security hardening

---

## Step 1: Re-Connect OAuth Services

Your OAuth services were disconnected during the database recreation. You'll need to re-authorize each one.

### Services to Re-Connect

```
1. Google       (Email, Calendar, Drive, Sheets)
2. GitHub       (Repos, Issues, PRs)
3. Discord      (Messaging, Webhooks)
4. Slack        (Workspace integration)
5. Twitter/X    (Social media posting)
6. Facebook     (Meta apps integration)
7. LinkedIn     (Professional network)
8. TikTok       (Social media)
9. Notion       (Database sync)
```

### How to Re-Connect

1. Go to **Dashboard → Services** (or **Settings → Connected Services**)
2. Click "Connect" for each service
3. Authorize with your credentials
4. Verify connection with test API call

**Each connection takes ~1-2 minutes.**

---

## Step 2: Re-Upload Skills

Your custom skills were lost. You can:

### Option A: Re-Create Manually
1. Go to **Skills** section
2. Click "Create New Skill"
3. Add name, description, script content
4. Save and publish

### Option B: Bulk Import (If You Have Backup)
If you have a ZIP backup of your skills:
1. Go to **Data → Import**
2. Upload the ZIP file
3. Select "Skills" to import
4. Verify each skill imported correctly

### Skills to Recreate

If you remember your custom skills, here are the system skills available by default:
- concur-expense-report
- gateway-tokens
- gog-reauth
- ha-mcp
- identity-docs-ingestion
- mcporter-ha-mcp-recovery
- personal-brain
- piper-whatsapp-tts
- tello-flight-recovery
- vault-manager

---

## Step 3: Re-Upload Knowledge Base

You can now upload knowledge base documents (the table was missing, now fixed).

### How to Add KB Documents

1. Go to **Knowledge Base**
2. Click "Add Document"
3. Enter:
   - Title
   - Content (markdown supported)
   - Category (e.g., "API", "Tutorial", "Reference")
   - Tags (e.g., "oauth", "integration")
   - Source (where this info came from)
4. Save

### Example Documents to Create

```
- "MyApi OAuth Setup Guide"
- "Available Services & APIs"
- "Notification System Reference"
- "Security Best Practices"
- "Backup & Recovery Procedures"
- "API Rate Limits & Quotas"
```

---

## Step 4: Verify Data Restoration

### Checklist

- [ ] All 9 OAuth services reconnected and tested
- [ ] Skills section shows your custom skills
- [ ] Knowledge base documents visible and searchable
- [ ] Personas loaded correctly
- [ ] Vault tokens showing (encrypted, no exposure)
- [ ] Dashboard loads without errors
- [ ] Notifications working (bell icon shows unread count)

### Test Requests

```bash
# Check OAuth services connected
curl -H "Authorization: Bearer <token>" https://www.myapiai.com/api/v1/services

# Check skills
curl -H "Authorization: Bearer <token>" https://www.myapiai.com/api/v1/skills

# Check KB documents
curl -H "Authorization: Bearer <token>" https://www.myapiai.com/api/v1/knowledge-base

# Check vault tokens
curl -H "Authorization: Bearer <token>" https://www.myapiai.com/api/v1/vault-tokens
```

---

## Step 5: Prevent Future Data Loss

### Automated Daily Backups

We'll implement:
1. **Daily encrypted backups** to secure storage
2. **Weekly off-site backups** (e.g., AWS S3)
3. **Monthly full snapshots** with verification
4. **Automated restore testing** (test backups are recoverable)

### Backup Strategy

**Local Backup (Daily)**
```
/backups/myapi.db.20260326-daily
/backups/myapi.db.20260327-daily
/backups/myapi.db.20260328-daily
```

**Off-Site Backup (Weekly)**
```
s3://myapi-backups/myapi.db.20260323-weekly
s3://myapi-backups/myapi.db.20260330-weekly
```

**Retention Policy**
- Daily: Keep 7 days
- Weekly: Keep 4 weeks
- Monthly: Keep 12 months

### Testing Backups

Every Monday: Restore a backup to test environment and verify:
1. Database integrity
2. All tables present
3. Data completeness
4. Application starts without errors

---

## Step 6: Security Hardening

### Remaining Critical Issues to Fix

1. **Rate Limiting**
   - Limit `/gateway/context` to 1 request/minute
   - Limit `/auth/login` to 5 attempts/hour
   - Limit `/auth/register` to 5/hour per IP

2. **Audit Log Immutability**
   - Store audit logs in append-only file
   - Sign logs with cryptographic keys
   - Alert on any log modification

3. **Token Rotation**
   - Rotate encryption keys quarterly
   - Force re-authentication on sensitive operations
   - Implement device revocation

---

## Timeline

**Today (Mar 26):**
- [x] Fix database schema
- [x] Create knowledge_base table
- [ ] Re-connect OAuth services (your task - ~20 min)
- [ ] Re-upload skills (your task - ~30 min)
- [ ] Re-upload KB docs (your task - ~15 min)

**Tomorrow (Mar 27):**
- [ ] Implement automated backup strategy
- [ ] Add rate limiting to sensitive endpoints
- [ ] Complete security hardening

**Next Week:**
- [ ] External security audit
- [ ] Penetration testing
- [ ] Production launch readiness

---

## Support

If you encounter issues during data recovery:

1. **Check error logs:** `/tmp/myapi.log`
2. **Verify API responses:** Use curl to test endpoints
3. **Check database:** `sqlite3 src/data/myapi.db`.schema`
4. **Review commits:** `git log --oneline -20` to see recent changes

---

**Last Updated:** 2026-03-26  
**Status:** Schema fixed, ready for data restoration  
**Next Step:** Re-connect OAuth services

