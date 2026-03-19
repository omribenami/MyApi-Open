# Skill Origin Tracking & IP Protection Implementation

## Overview
This document details the complete implementation of the skill origin tracking, IP protection, and marketplace IP system for MyApi. The system spans 5 phases and includes database schema updates, GitHub integration, skill versioning, fork tracking, license management, and ownership verification.

## Architecture & Components

### 1. Database Schema (Phase 1: Skill Origin & Attribution)

#### Skills Table Enhancements
```sql
-- Added columns to skills table:
origin_type TEXT DEFAULT 'local'           -- 'github' | 'marketplace' | 'local'
origin_source_id TEXT                      -- marketplace listing ID
origin_owner TEXT                          -- GitHub owner or user ID
origin_owner_type TEXT DEFAULT 'myapi_user' -- 'github_user' | 'myapi_user' | 'marketplace'
is_fork INTEGER DEFAULT 0                  -- boolean: 1 if forked, 0 if original
upstream_owner TEXT                        -- original creator username if forked
upstream_repo_url TEXT                     -- original repo URL if forked from GitHub
license TEXT DEFAULT 'Proprietary'         -- MIT | Apache | GPL | Proprietary | Custom
published_at TEXT                          -- timestamp of first publication
```

### 2. New Tables

#### skill_versions (Phase 2: Skill Versioning & Immutability)
```sql
CREATE TABLE skill_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id INTEGER NOT NULL,
  version_number TEXT NOT NULL,            -- e.g., "1.0.0", "1.0.1"
  content_hash TEXT NOT NULL,               -- SHA256 of script_content
  created_at TEXT NOT NULL,
  creator_id TEXT NOT NULL,                -- User who created version
  release_notes TEXT,                      -- Version notes/changelog
  script_content TEXT,                     -- Full script content (immutable)
  config_json TEXT,                        -- Full config (immutable)
  UNIQUE(skill_id, version_number)
);
```

**Key Features:**
- Immutable: once published, versions cannot be edited
- Content hashed using SHA256 for integrity
- Full history preserved for every version
- Prevents editing published skills (force new version instead)

#### skill_licenses (Phase 4: License System)
```sql
CREATE TABLE skill_licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_name TEXT NOT NULL UNIQUE,       -- MIT, Apache 2.0, GPL, Proprietary, Custom
  description TEXT,
  can_fork INTEGER DEFAULT 1,              -- Can the skill be forked?
  can_sell INTEGER DEFAULT 0,              -- Can the skill be sold/monetized?
  can_modify INTEGER DEFAULT 1,            -- Can the skill be modified?
  attribution_required INTEGER DEFAULT 0,  -- Must creator be attributed?
  license_text TEXT,                       -- Full license text
  created_at TEXT NOT NULL
);
```

**Default Licenses:**
- **MIT**: Free, requires attribution, allows fork/sell/modify
- **Apache 2.0**: Free, requires attribution, allows fork/sell/modify, explicit patent rights
- **GPL**: Free, requires attribution, disallows selling, requires derivatives to be open-source
- **Proprietary**: No fork/modify/sell allowed without permission
- **Custom**: Custom terms defined by creator

#### skill_forks (Phase 3: Fork & Derivative Tracking)
```sql
CREATE TABLE skill_forks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_skill_id INTEGER NOT NULL,
  fork_skill_id INTEGER NOT NULL,
  forked_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(original_skill_id, fork_skill_id)
);
```

**Tracks:**
- Relationship between original and forked skills
- User who created the fork
- Fork creation timestamp
- Prevents duplicate forks

#### skill_ownership_claims (Phase 4: Ownership Verification)
```sql
CREATE TABLE skill_ownership_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id INTEGER NOT NULL,
  claimant_user_id TEXT NOT NULL,
  github_username TEXT,
  marketplace_user_id TEXT,
  verified INTEGER DEFAULT 0,
  verification_code TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(skill_id, claimant_user_id)
);
```

**Verification Methods:**
- GitHub username matching against repo owner
- Marketplace creator verification
- Optional verification code flow for custom verification

## Database Functions

### Phase 1: Skill Origin & Attribution
```javascript
// Update skill origin information
updateSkillOrigin(skillId, originData, ownerId)
// originData: { origin_type, origin_source_id, origin_owner, origin_owner_type, is_fork, upstream_owner, upstream_repo_url, license }
```

### Phase 2: Skill Versioning & Immutability
```javascript
// Create a new version of a skill
createSkillVersion(skillId, versionNumber, contentHash, creatorId, releaseNotes, scriptContent, configJson, ownerId)

// Get all versions of a skill
getSkillVersions(skillId, ownerId) // Returns array of versions in descending order

// Get specific version
getSkillVersion(skillId, versionNumber, ownerId)
```

### Phase 3: Fork & Derivative Tracking
```javascript
// Create a fork relationship
createSkillFork(originalSkillId, newSkillId, forkedByUserId, ownerId)

// Get all forks of a skill
getSkillForks(skillId) // Returns array of fork relationships

// Get fork info for a skill (if it's a fork)
getSkillForkInfo(skillId) // Returns { originalSkillId, forkedByUserId, createdAt }
```

### Phase 4: License System
```javascript
// Get all available licenses
getLicenses() // Returns array of { id, licenseName, description, canFork, canSell, canModify, attributionRequired }

// Get specific license
getLicense(licenseName)

// Validate if operation is allowed by license
validateLicenseOperation(skillLicense, operation) // operation: 'fork' | 'sell' | 'modify'
```

### Phase 4: Ownership Verification
```javascript
// Create ownership claim
createOwnershipClaim(skillId, claimantUserId, githubUsername, marketplaceUserId, ownerId)

// Get ownership claim
getOwnershipClaim(skillId, claimantUserId, ownerId)

// Verify ownership
verifyOwnershipClaim(skillId, claimantUserId, ownerId)

// Get all claims for a skill
getSkillOwnershipClaims(skillId, ownerId)
```

## GitHub Integration (github-repo-metadata.js)

### Service: GitHubRepoMetadata
Handles all GitHub-related operations for skill origin tracking.

#### Key Methods

```javascript
// Fetch repository metadata
getRepoMetadata(owner, repo)
// Returns: { id, name, owner, ownerType, isFork, parentOwner, parentName, description, url, language, stars, forks, license, topics, isPublic, updatedAt, createdAt }

// Verify user owns a repository
verifyRepoOwnership(owner, repo, userToken)
// Returns: boolean

// Get fork information
getForkInfo(owner, repo)
// Returns: { isFork, parentOwner, parentName, parentUrl, forks, watchers }

// Get GitHub user information
getUserInfo(username)
// Returns: { username, name, avatar, type, publicRepos, followers, following, createdAt }

// Parse GitHub URL
parseGitHubUrl(url)
// Supports: https://github.com/owner/repo, git@github.com:owner/repo, owner/repo
// Returns: { owner, repo } or null
```

## API Routes (GET /api/v1/skills/*)

### List Skills
```
GET /api/v1/skills
Query Parameters:
  - include_archived: boolean (optional)

Response:
{
  "skills": [
    {
      "id": 1,
      "name": "My Skill",
      "description": "...",
      "version": "1.0.0",
      "author": "...",
      "category": "custom",
      "script_content": "...",
      "config_json": {},
      "repo_url": "https://github.com/owner/repo",
      "active": false,
      "owner_id": "user123",
      "created_at": "2026-03-19T08:00:00Z",
      "updated_at": "2026-03-19T08:00:00Z",
      "origin": {
        "type": "github",
        "sourceId": null,
        "owner": "octocat",
        "ownerType": "github_user",
        "isFork": false,
        "upstreamOwner": null,
        "upstreamRepoUrl": null,
        "license": "MIT",
        "publishedAt": null
      },
      "isFork": false
    }
  ]
}
```

### Get Skill Details
```
GET /api/v1/skills/:id

Response:
{
  "skill": {
    // ... skill fields ...
    "origin": { ... },
    "versions": [
      {
        "id": 1,
        "skillId": 1,
        "versionNumber": "1.0.0",
        "contentHash": "sha256hash...",
        "createdAt": "2026-03-19T08:00:00Z",
        "creatorId": "user123",
        "releaseNotes": "Initial release"
      }
    ],
    "forkInfo": null, // or { originalSkillId: X, forkedByUserId: "user123", createdAt: "..." }
    "ownershipClaims": [
      {
        "id": 1,
        "claimantUserId": "user123",
        "githubUsername": "octocat",
        "marketplaceUserId": null,
        "verified": true,
        "verifiedAt": "2026-03-19T08:30:00Z"
      }
    ]
  }
}
```

### Create Skill with Origin Detection
```
POST /api/v1/skills

Body:
{
  "name": "My Awesome Skill",
  "description": "Does something amazing",
  "category": "automation",
  "scriptContent": "...",
  "configJson": {},
  "repoUrl": "https://github.com/octocat/awesome-skill",
  "originType": "github",
  "originOwner": "octocat",
  "license": "MIT",
  "githubUsername": "octocat"
}

Response: 201 Created
{
  "skill": {
    // ... skill with origin info auto-detected from GitHub ...
  }
}
```

**GitHub Auto-Detection:**
- Fetches repo metadata when repoUrl provided with originType="github"
- Automatically detects fork status
- Extracts license from GitHub license field
- Stores upstream owner/repo if forked
- Maps GitHub SPDX licenses to MyApi licenses

### Create Skill Version
```
POST /api/v1/skills/:id/versions

Body:
{
  "releaseNotes": "Added new features and fixed bugs"
}

Response: 201 Created
{
  "version": {
    "id": 2,
    "skillId": 1,
    "versionNumber": "1.0.1",
    "contentHash": "newhash...",
    "createdAt": "2026-03-19T09:00:00Z",
    "creatorId": "user123",
    "releaseNotes": "Added new features and fixed bugs"
  }
}
```

**Version Numbering:**
- Auto-increments patch version (major.minor.patch)
- Immutable: published versions cannot be edited
- Content hash validates integrity

### Get Skill Versions
```
GET /api/v1/skills/:id/versions

Response:
{
  "versions": [
    {
      "id": 2,
      "skillId": 1,
      "versionNumber": "1.0.1",
      "contentHash": "...",
      "createdAt": "...",
      "creatorId": "user123",
      "releaseNotes": "..."
    },
    {
      "id": 1,
      "skillId": 1,
      "versionNumber": "1.0.0",
      "contentHash": "...",
      "createdAt": "...",
      "creatorId": "user123",
      "releaseNotes": "Initial release"
    }
  ]
}
```

### Fork Skill
```
POST /api/v1/skills/:id/fork

Body:
{
  "name": "My Custom Version of X",
  "description": "Modified for our use case"
}

Response: 201 Created
{
  "skill": {
    "id": 2,
    "name": "My Custom Version of X",
    // ... other fields ...
    "origin": {
      "type": "local",
      "isFork": true,
      "upstreamOwner": "original-creator",
      "upstreamRepoUrl": "https://github.com/original-creator/original-skill",
      "license": "MIT"
    }
  }
}
```

**Fork Validation:**
- Checks if license allows forking
- Returns 403 if license disallows forking (e.g., Proprietary)
- Creates skill_forks relationship
- Auto-detects upstream if original is forked

### Get Skill Forks
```
GET /api/v1/skills/:id/forks

Response:
{
  "forks": [
    {
      "id": 1,
      "originalSkillId": 1,
      "forkSkillId": 2,
      "forkedByUserId": "user456",
      "createdAt": "2026-03-19T10:00:00Z"
    }
  ]
}
```

### Get Available Licenses
```
GET /api/v1/licenses

Response:
{
  "licenses": [
    {
      "id": 1,
      "licenseName": "MIT",
      "description": "Permissive open-source license",
      "canFork": true,
      "canSell": true,
      "canModify": true,
      "attributionRequired": true
    },
    {
      "id": 2,
      "licenseName": "Apache 2.0",
      "description": "Permissive open-source license with explicit patent rights",
      "canFork": true,
      "canSell": true,
      "canModify": true,
      "attributionRequired": true
    },
    {
      "id": 3,
      "licenseName": "GPL",
      "description": "Copyleft open-source license; derivatives must be open-source",
      "canFork": true,
      "canSell": false,
      "canModify": true,
      "attributionRequired": true
    },
    {
      "id": 4,
      "licenseName": "Proprietary",
      "description": "Proprietary license; no forking or modification allowed",
      "canFork": false,
      "canSell": true,
      "canModify": false,
      "attributionRequired": false
    }
  ]
}
```

### Create Ownership Claim
```
POST /api/v1/skills/:id/verify-ownership

Body:
{
  "githubUsername": "octocat",
  "marketplaceUserId": null
}

Response: 201 Created
{
  "claim": {
    "id": 1,
    "skillId": 1,
    "claimantUserId": "user123",
    "githubUsername": "octocat",
    "marketplaceUserId": null,
    "verified": false,
    "createdAt": "2026-03-19T08:00:00Z"
  }
}
```

### Verify Ownership
```
POST /api/v1/skills/:id/verify-ownership/:claimId

Response:
{
  "claim": {
    "id": 1,
    "skillId": 1,
    "claimantUserId": "user123",
    "githubUsername": "octocat",
    "marketplaceUserId": null,
    "verified": true,
    "verifiedAt": "2026-03-19T08:30:00Z"
  },
  "verified": true
}
```

**Verification Process:**
- For GitHub: compares githubUsername with repo owner
- For Marketplace: compares with listing creator
- Sets verified flag and verified_at timestamp

## Implementation Details

### Database Migrations
All new tables and columns are created automatically on application startup:
- Creates tables if they don't exist
- Adds new columns to existing tables (using ALTER TABLE)
- Automatically populates default licenses
- Creates necessary indices for performance

### GitHub License Mapping
Maps SPDX license IDs to MyApi licenses:
- `MIT` → MIT
- `Apache-2.0` → Apache 2.0
- `GPL-2.0`, `GPL-3.0`, `AGPL-3.0` → GPL

### Version Numbering
- Format: `major.minor.patch`
- Starts at `1.0.0`
- Auto-increments patch on each version
- Can be manually set for major/minor version bumps

### Fork Tracking
- Tracks original skill ID and fork skill ID
- Prevents duplicate fork relationships (UNIQUE constraint)
- Links fork skill's upstream_owner to original creator
- Allows querying fork chains (original → derivative → further derivative)

### Ownership Verification
- GitHub verification: matches repo owner with claimed username
- Creates verification audit trail with timestamps
- Supports multiple verification methods per skill
- Prevents unverified claims from impacting skill metadata

## Test Scenarios

### Scenario 1: Import GitHub Skill
```javascript
// User imports skill from GitHub
POST /api/v1/skills {
  "name": "Twitter Integration",
  "repoUrl": "https://github.com/octocat/twitter-skill",
  "originType": "github",
  "githubUsername": "octocat"
}

// Expected behavior:
// 1. Fetches metadata from GitHub API
// 2. Detects if it's a fork
// 3. Extracts license (if present)
// 4. Creates ownership claim for GitHub username
// 5. Returns skill with origin info populated
```

### Scenario 2: Fork Licensed Skill
```javascript
// User tries to fork a Proprietary-licensed skill
POST /api/v1/skills/123/fork {
  "name": "My Version"
}

// Expected response: 403 Forbidden
// "License does not allow forking"

// User forks MIT-licensed skill
POST /api/v1/skills/456/fork {
  "name": "My Customized Version"
}

// Expected behavior:
// 1. Creates new skill
// 2. Marks as fork with upstream info
// 3. Preserves license from original
// 4. Creates skill_forks relationship
```

### Scenario 3: Version History
```javascript
// User creates skill, makes changes, publishes new version
POST /api/v1/skills/789/versions {
  "releaseNotes": "v1.0.1: Fixed bug in condition parsing"
}

// Expected behavior:
// 1. Calculates content hash
// 2. Auto-increments to version 1.0.1
// 3. Creates immutable version record
// 4. Updates skill's version reference
// 5. Prevents editing v1.0.0

// User attempts to edit v1.0.0
PUT /api/v1/skills/789/versions/1.0.0

// Expected response: 405 Method Not Allowed
// "Cannot edit published versions. Create a new version instead."
```

### Scenario 4: Ownership Verification
```javascript
// User claims GitHub ownership
POST /api/v1/skills/999/verify-ownership {
  "githubUsername": "octocat"
}

// User verifies ownership
POST /api/v1/skills/999/verify-ownership/1

// Expected behavior:
// 1. Checks GitHub repo matches username
// 2. Sets verified flag
// 3. Records verification timestamp
// 4. Returns verification badge for UI
```

## Frontend UI Enhancements (Recommended)

### Skills List Page
- Badge: "✓ Original" (green), "⚠️ Fork" (amber), "❌ Unverified" (red)
- Show: "By @github_owner" or "By @marketplace_creator"
- License tag: MIT, Proprietary, GPL, etc.
- Version number: "v1.0.0"

### Skill Detail Page
- Provenance chain: Original Author → [Versions] → You (if forked)
- License info with "can fork/sell/modify" status
- Fork count / derivative count
- If forked: "Derived from @original-author/original-skill v1.2.3" with link

### Skill Creation Form
- Auto-detect GitHub owner + fork status when pasting URL
- Show origin verification status
- License selector dropdown
- Warn if forking someone else's proprietary skill

### Marketplace Listing
- Show "Published by @cloud" with verified badge
- Show license
- Warn if installing a fork: "This is a derivative work"

## Security Considerations

1. **License Enforcement**: Blocks operations disallowed by license (fork, sell, modify)
2. **Ownership Verification**: Validates GitHub repo ownership before marking verified
3. **Immutability**: Published versions cannot be edited, preventing supply-chain attacks
4. **Attribution**: Can require attribution in license to prevent plagiarism
5. **Audit Trail**: All versions, forks, and claims recorded with timestamps
6. **Multi-tenant Isolation**: owner_id column ensures users only see/modify their skills

## Performance Optimizations

1. **Indices**: Created on:
   - `skill_versions(skill_id, version_number)`
   - `skill_forks(original_skill_id, fork_skill_id)`
   - `skill_ownership_claims(skill_id, claimant_user_id)`
2. **Content Hashing**: SHA256 used for efficient content deduplication
3. **Query Efficiency**: Foreign key constraints prevent orphaned records

## Future Enhancements

1. **Skill Marketplace Integration**: List skills on marketplace with creator attribution
2. **Automated License Detection**: Scan GitHub for LICENSE files automatically
3. **Fork Chain UI**: Visualize full derivation chain
4. **License Enforcement Hooks**: Prevent GPL skill sale, etc.
5. **Donation Links**: Track original creator for potential donations
6. **Skill Discovery**: Suggest similar skills, show popular forks
7. **Bulk Operations**: Import multiple skills from GitHub orgs/users

## Summary

This implementation provides a complete skill origin tracking and IP protection system that:
- ✅ Tracks skill origins (GitHub, marketplace, local)
- ✅ Detects forks and derivatives
- ✅ Manages licenses and permissions
- ✅ Verifies ownership
- ✅ Maintains immutable version history
- ✅ Integrates with GitHub API
- ✅ Provides comprehensive API for skill management
- ✅ Supports multi-tenant isolation
- ✅ Includes audit trails and verification records

All features are implemented with proper error handling, validation, and security considerations.
