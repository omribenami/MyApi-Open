# Skill Origin Tracking - Testing Guide

## Quick Start

### 1. Database Setup
On application startup, the following is automatically set up:
```javascript
// Migrations run automatically:
- skill_versions table created
- skill_licenses table created with defaults
- skill_forks table created
- skill_ownership_claims table created
- New columns added to skills table:
  - origin_type, origin_source_id, origin_owner, origin_owner_type
  - is_fork, upstream_owner, upstream_repo_url, license, published_at
```

### 2. Default Licenses Populated
```javascript
// Automatically inserted:
MIT, Apache 2.0, GPL, Proprietary, Custom
```

## API Testing Examples

### Test 1: List Skills with Origin Info
```bash
curl -X GET http://localhost:4500/api/v1/skills \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected response includes:
{
  "skills": [
    {
      "id": 1,
      "name": "My Skill",
      "origin": {
        "type": "local",
        "owner": null,
        "isFork": false,
        "license": "Proprietary"
      }
    }
  ]
}
```

### Test 2: Create Skill from GitHub
```bash
curl -X POST http://localhost:4500/api/v1/skills \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Twitter Integration",
    "description": "Integrate with Twitter API",
    "repoUrl": "https://github.com/octocat/twitter-skill",
    "originType": "github",
    "githubUsername": "octocat",
    "category": "integration",
    "license": "MIT"
  }'

# Expected behavior:
# 1. Fetches metadata from GitHub API
# 2. Auto-detects fork status
# 3. Extracts license
# 4. Returns skill with origin populated
```

### Test 3: Create Skill Version
```bash
curl -X POST http://localhost:4500/api/v1/skills/1/versions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "releaseNotes": "v1.0.1: Fixed bug in token parsing"
  }'

# Expected response:
{
  "version": {
    "id": 2,
    "skillId": 1,
    "versionNumber": "1.0.1",
    "contentHash": "sha256...",
    "creatorId": "user123",
    "releaseNotes": "v1.0.1: Fixed bug in token parsing"
  }
}
```

### Test 4: Get Version History
```bash
curl -X GET http://localhost:4500/api/v1/skills/1/versions \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected response:
{
  "versions": [
    { "versionNumber": "1.0.1", ... },
    { "versionNumber": "1.0.0", ... }
  ]
}
```

### Test 5: Fork MIT-Licensed Skill
```bash
curl -X POST http://localhost:4500/api/v1/skills/1/fork \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Custom Twitter Integration",
    "description": "Modified for our use case"
  }'

# Expected behavior:
# - License allows forking (MIT)
# - Creates new skill
# - Marks as fork with upstream info
# - Returns 201 Created

# Response:
{
  "skill": {
    "id": 2,
    "name": "My Custom Twitter Integration",
    "origin": {
      "isFork": true,
      "upstreamOwner": "octocat",
      "license": "MIT"
    }
  }
}
```

### Test 6: Attempt to Fork Proprietary Skill (Should Fail)
```bash
# Create proprietary skill
curl -X POST http://localhost:4500/api/v1/skills \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Commercial Tool",
    "license": "Proprietary"
  }'

# Try to fork it
curl -X POST http://localhost:4500/api/v1/skills/3/fork \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name": "My Fork"}'

# Expected response: 403 Forbidden
{
  "error": "License does not allow forking",
  "license": "Proprietary"
}
```

### Test 7: Get Available Licenses
```bash
curl -X GET http://localhost:4500/api/v1/licenses \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected response:
{
  "licenses": [
    {
      "id": 1,
      "licenseName": "MIT",
      "canFork": true,
      "canSell": true,
      "canModify": true,
      "attributionRequired": true
    },
    {
      "id": 4,
      "licenseName": "Proprietary",
      "canFork": false,
      "canSell": true,
      "canModify": false,
      "attributionRequired": false
    }
  ]
}
```

### Test 8: Create Ownership Claim
```bash
curl -X POST http://localhost:4500/api/v1/skills/1/verify-ownership \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "githubUsername": "octocat"
  }'

# Expected response: 201 Created
{
  "claim": {
    "id": 1,
    "skillId": 1,
    "claimantUserId": "user123",
    "githubUsername": "octocat",
    "verified": false,
    "createdAt": "2026-03-19T..."
  }
}
```

### Test 9: Verify Ownership
```bash
curl -X POST http://localhost:4500/api/v1/skills/1/verify-ownership/1 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected behavior:
# 1. Validates GitHub username matches repo owner
# 2. Sets verified flag
# 3. Records verification timestamp

# Response:
{
  "claim": {
    "id": 1,
    "verified": true,
    "verifiedAt": "2026-03-19T..."
  },
  "verified": true
}
```

### Test 10: Get Full Skill Details with All Info
```bash
curl -X GET http://localhost:4500/api/v1/skills/1 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected response includes:
{
  "skill": {
    "id": 1,
    "name": "Twitter Integration",
    "version": "1.0.1",
    "origin": {
      "type": "github",
      "owner": "octocat",
      "isFork": false,
      "license": "MIT",
      "publishedAt": "2026-03-19T..."
    },
    "versions": [
      { "versionNumber": "1.0.1", ... },
      { "versionNumber": "1.0.0", ... }
    ],
    "forkInfo": null,
    "ownershipClaims": [
      {
        "githubUsername": "octocat",
        "verified": true,
        "verifiedAt": "2026-03-19T..."
      }
    ]
  }
}
```

## Database Queries for Manual Testing

### Check if Skills Table Has New Columns
```sql
-- Verify origin columns exist
SELECT origin_type, origin_owner, is_fork, license 
FROM skills LIMIT 1;

-- Should return columns without error
```

### Verify License Data
```sql
-- Check default licenses were created
SELECT license_name, can_fork, can_sell, can_modify 
FROM skill_licenses 
ORDER BY license_name;

-- Expected rows:
-- MIT | 1 | 1 | 1
-- Apache 2.0 | 1 | 1 | 1
-- GPL | 1 | 0 | 1
-- Proprietary | 0 | 1 | 0
-- Custom | 0 | 0 | 0
```

### Check Skill Versions
```sql
-- View version history
SELECT id, skill_id, version_number, content_hash, creator_id
FROM skill_versions
WHERE skill_id = 1
ORDER BY created_at DESC;
```

### Check Fork Relationships
```sql
-- View all forks
SELECT original_skill_id, fork_skill_id, forked_by_user_id, created_at
FROM skill_forks
ORDER BY created_at DESC;
```

### Check Ownership Claims
```sql
-- View claims for a skill
SELECT skill_id, claimant_user_id, github_username, verified, verified_at
FROM skill_ownership_claims
WHERE skill_id = 1;
```

## Test Data Setup

### Create Sample Skills
```bash
# Original skill
curl -X POST http://localhost:4500/api/v1/skills \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Email Notifications",
    "description": "Send email notifications from your workflows",
    "repoUrl": "https://github.com/sample/email-notifications",
    "originType": "github",
    "license": "MIT",
    "githubUsername": "sample"
  }'

# Proprietary skill (no fork allowed)
curl -X POST http://localhost:4500/api/v1/skills \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Premium Analytics",
    "description": "Advanced analytics engine",
    "license": "Proprietary"
  }'

# Marketplace skill
curl -X POST http://localhost:4500/api/v1/skills \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Cloud Storage Sync",
    "description": "Sync files to cloud storage",
    "originType": "marketplace",
    "originSourceId": "mp_12345",
    "originOwner": "cloud-vendor",
    "license": "Apache 2.0"
  }'
```

### Fork the MIT Skill
```bash
curl -X POST http://localhost:4500/api/v1/skills/1/fork \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Email Notifications (Custom)",
    "description": "Modified for our company"
  }'
```

### Create Versions
```bash
# First version already created as 1.0.0
# Create 1.0.1
curl -X POST http://localhost:4500/api/v1/skills/1/versions \
  -H "Authorization: Bearer TOKEN" \
  -d '{"releaseNotes": "Fixed SMTP timeout issue"}'

# Create 1.0.2
curl -X POST http://localhost:4500/api/v1/skills/1/versions \
  -H "Authorization: Bearer TOKEN" \
  -d '{"releaseNotes": "Added HTML template support"}'
```

## Verification Checklist

- [ ] Database tables created: skill_versions, skill_licenses, skill_forks, skill_ownership_claims
- [ ] New columns added to skills table: origin_type, origin_owner, is_fork, license, etc.
- [ ] Default licenses inserted: MIT, Apache 2.0, GPL, Proprietary, Custom
- [ ] API route /api/v1/skills registered and working
- [ ] Create skill with GitHub URL auto-detects fork status
- [ ] Create skill version increments version number
- [ ] Fork MIT-licensed skill succeeds
- [ ] Fork Proprietary-licensed skill fails with 403
- [ ] Ownership claim created and verified
- [ ] License validation works for fork/sell/modify operations
- [ ] Full skill details include versions, forks, ownership claims
- [ ] All endpoints require authentication
- [ ] Content hash calculated for version integrity

## Troubleshooting

### Issue: Database migration fails
**Solution**: Ensure db.sqlite has write permissions. Check logs for specific migration error.

### Issue: GitHub API returns 403
**Solution**: Check if GITHUB_PERSONAL_TOKEN environment variable is set. Some operations require authentication.

### Issue: Fork endpoint returns 404
**Solution**: Verify the original skill exists and you have access to it. Check owner_id matches.

### Issue: Version number doesn't increment
**Solution**: Check that previous version exists in skill_versions table. Verify syntax of release_notes parameter.

### Issue: License data not populated
**Solution**: Check if skill_licenses table exists. Try deleting table and restarting app to trigger migration.

## Performance Notes

- Version queries return full version history; consider pagination for large histories
- Fork queries scan skill_forks table; large datasets may need index optimization
- GitHub API calls are synchronous; consider adding caching for frequently accessed repos
- Content hash calculation is fast (SHA256) and suitable for large scripts

## Next Steps

1. Run all tests above to verify functionality
2. Test with real GitHub repositories
3. Create UI components for origin badges and license display
4. Implement marketplace integration
5. Set up automated license compliance checking
6. Add notification system for fork/derivative creation
