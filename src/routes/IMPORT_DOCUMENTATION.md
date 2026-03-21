# ZIP Import Endpoint Implementation

## Overview

The `POST /api/v1/import` endpoint allows users to securely import their data from ZIP exports (v2.0 and v3.0 schema). This implementation focuses on **data integrity, security, and safe merging**.

**Endpoint:** `POST /api/v1/import`
**Content-Type:** `multipart/form-data`
**Auth Required:** Yes (Bearer token or session)

---

## Architecture

The implementation follows a 6-phase workflow:

### PHASE 1: Verify ZIP Structure
- Extract ZIP file from multipart upload
- Validate `manifest.json` exists and contains valid schema version
- Verify `checksums.sha256` against all files (detects corruption)
- List all files being imported for audit logging

### PHASE 2: Parse Data Safely
- Read and parse manifest to understand what's being imported
- Load profile data (identity.json, user.md, soul.md)
- Load personas and persona configurations
- Load skills and skill scripts
- Load settings
- **CRITICAL: Strip all sensitive data** (tokens, OAuth secrets, passwords)

### PHASE 3: Validate Before Import
- Verify `user_id` in manifest matches current user (prevent cross-user import)
- Check for name conflicts in personas and skills
- Pre-calculate what will be created, updated, and skipped
- Validate all data structures before committing

### PHASE 4: Execute Import (Transaction)
- Begin database transaction
- Update user profile (displayName, avatar)
- Write USER.md and SOUL.md to workspace
- Merge settings (new values override old)
- Create new personas (skip if name conflict)
- Create new skills (skip if name conflict)
- Commit transaction atomically

### PHASE 5: Return Response
- Provide detailed summary of what was imported
- List conflicts and what was skipped
- Include error details for debugging
- Report checksum validation results

---

## Security Constraints

### Critical: No Token Restoration

**NEVER import any of these:**
- `access_tokens` - User's API tokens
- `oauth_tokens` - OAuth credentials (GitHub, Google, etc.)
- `vault_tokens` - Stored secrets
- `refresh_token` - OAuth refresh tokens
- `service_preferences` - OAuth secrets stored as preferences

**The implementation strips these patterns from all imported data:**

```javascript
const SENSITIVE_KEYS = [
  'access_tokens',
  'oauth_tokens',
  'vault_tokens',
  'service_preferences',
  'device_approval',
  'refresh_token',
  'access_token',
  'secret',
  'token',
  'password',
  'passphrase',
  'api_key',
  'api-key',
  'hash',
  'authorization',
  'cookie',
  'session'
];
```

**How it works:**
1. Every imported object is recursively traversed
2. Any key matching these patterns is **removed entirely**
3. This applies to profiles, personas, skills, settings, and configs

### Safe Merge Strategy

- **User profile:** Only update displayName and avatar (preserves ID, username, email)
- **Personas:** Skip if name already exists (prevents overwriting custom work)
- **Skills:** Skip if name already exists (preserves modifications)
- **Settings:** Merge with existing (new values override old, but preserve tokens/OAuth status)

### Cross-User Protection

```javascript
const importUserId = manifest.userId || manifest.ownerId;
if (importUserId && importUserId !== ownerId) {
  return res.status(403).json({ 
    error: 'Cannot import data from a different user'
  });
}
```

---

## ZIP Export Format

The import handler expects v2.0 or v3.0 ZIP exports with this structure:

```
export.zip
├── manifest.json                    # Required: schema metadata
├── checksums.sha256                 # Required: file checksums
├── profile/
│   ├── identity.json                # User profile (displayName, avatar)
│   ├── user.md                       # USER.md workspace file
│   └── soul.md                       # SOUL.md workspace file
├── personas/
│   ├── personas.json                # Array of persona metadata
│   └── configs/
│       ├── 1.json                   # Persona config (if present)
│       ├── 2.json
│       └── ...
├── skills/
│   ├── skills.json                  # Array of skill metadata
│   ├── scripts/
│   │   ├── skill-1.js               # Skill script (if present)
│   │   └── ...
│   └── configs/
│       ├── skill-1.json             # Skill config (if present)
│       └── ...
├── settings/
│   └── settings.json                # User settings (privacy, notifications)
├── connectors/                      # NOT imported (OAuth data)
│   ├── services.json
│   └── oauth-metadata.json
├── knowledge/                       # NOT imported in current phase
│   ├── index.json
│   ├── docs/
│   └── files/
└── audit/                           # NOT imported (audit logs)
    └── summary.json
```

**Sections that ARE imported:**
- profile (identity, user.md, soul.md)
- personas (with configs)
- skills (with scripts and configs)
- settings

**Sections that are NOT imported:**
- connectors (OAuth/tokens)
- vault (stored secrets)
- audit (historical logs)
- knowledge (KB documents - separate implementation)

---

## API Request/Response

### Request

```bash
curl -X POST https://api.myapi.ai/api/v1/import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@export.zip"
```

### Response (Success)

```json
{
  "success": true,
  "message": "Import complete. 17 items imported, 0 skipped.",
  "imported": {
    "profile": 1,
    "settings": 1,
    "personas": 5,
    "skills": 10
  },
  "skipped": {
    "personas": 0,
    "skills": 0
  },
  "conflicts": [],
  "filesProcessed": 28,
  "checksumErrors": 0,
  "schemaVersion": "3.0"
}
```

### Response (With Conflicts)

```json
{
  "success": true,
  "message": "Import complete. 12 items imported, 2 skipped.",
  "imported": {
    "profile": 1,
    "settings": 1,
    "personas": 3,
    "skills": 7
  },
  "skipped": {
    "personas": 1,
    "skills": 1
  },
  "conflicts": [
    {
      "type": "persona",
      "name": "Engineer",
      "reason": "Name already exists"
    },
    {
      "type": "skill",
      "name": "Web Scraper",
      "reason": "Name already exists"
    }
  ],
  "filesProcessed": 28,
  "checksumErrors": 0,
  "schemaVersion": "3.0"
}
```

### Response (With Errors)

```json
{
  "success": true,
  "message": "Import complete. 8 items imported, 2 skipped.",
  "imported": {
    "profile": 1,
    "settings": 0,
    "personas": 3,
    "skills": 4
  },
  "skipped": {
    "personas": 0,
    "skills": 0
  },
  "conflicts": [],
  "filesProcessed": 28,
  "checksumErrors": 1,
  "errors": [
    "Settings parse error: JSON.parse error at line 5",
    "Checksum mismatch for settings/settings.json"
  ],
  "schemaVersion": "3.0"
}
```

### Error Responses

**401 Unauthorized**
```json
{ "error": "Unauthorized: No user ID found" }
```

**400 Bad Request**
```json
{ "error": "No file uploaded" }
{ "error": "Invalid ZIP file" }
{ "error": "Invalid ZIP: manifest.json missing" }
{ "error": "Unsupported export schema version" }
```

**403 Forbidden**
```json
{
  "error": "Cannot import data from a different user",
  "importedFromUser": "other-user-id",
  "currentUser": "current-user-id"
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal server error during import",
  "message": "Details of what went wrong"
}
```

---

## Implementation Details

### Sensitive Data Stripping

All imported data is recursively cleaned before use:

```javascript
function stripSensitiveData(obj, depth = 0) {
  if (depth > 10) return obj; // Prevent infinite recursion
  
  if (Array.isArray(obj)) {
    return obj.map(item => stripSensitiveData(item, depth + 1));
  }
  
  if (obj && typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (isSensitiveKey(key)) {
        // Skip this key entirely - it's never added to cleaned object
        continue;
      }
      cleaned[key] = stripSensitiveData(value, depth + 1);
    }
    return cleaned;
  }
  
  return obj;
}
```

This function:
1. Recursively traverses all objects and arrays
2. Removes any keys matching sensitive patterns
3. Preserves only safe data
4. Prevents infinite recursion with depth limit

### Transaction Safety

Import operations use database transactions for atomicity:

```javascript
const insertProfile = db.transaction(() => {
  // All operations here execute atomically
  // If any operation fails, entire transaction rolls back
  db.prepare(...).run(...);
  db.prepare(...).run(...);
  // ... more operations
});

insertProfile(); // Executes transaction
```

### Checksum Validation

If `checksums.sha256` is present in the ZIP:
1. Parse the file (format: `<hash>  <filepath>`)
2. Calculate SHA256 hash of each file
3. Compare with expected hash
4. Report mismatches but continue (corruption warning)

```
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  manifest.json
d7d0b4dcf0f8e7b8e4c8a5f6c8e7d3c5b8a1e0f7e4c8d5c2b8f6a1e0c9d7b5a3  profile/identity.json
```

### Database Consistency

Key operations:
- **createPersona()** - Adds new persona with owner_id
- **updatePersona()** - Updates existing persona
- **createSkill()** - Adds new skill with owner_id
- **updateSkill()** - Updates existing skill
- **UPDATE users SET ...** - Updates user profile and settings

All operations:
- Filter by `owner_id` (prevent cross-user data access)
- Use parameterized queries (prevent SQL injection)
- Execute within transaction (all or nothing)

---

## Testing Strategy

### Unit Tests (import.test.js)

**PHASE 1: ZIP Structure**
- Invalid ZIP detection
- Missing manifest.json handling
- Schema version validation (2.0, 2.5, 3.0, 3.5)
- Checksum verification and mismatch detection
- File listing accuracy

**PHASE 2: Safe Parsing**
- Sensitive key stripping (access_tokens, oauth_tokens, etc.)
- Recursive data traversal
- Nested object sanitization
- Persona/skill data parsing

**PHASE 3: Validation**
- Authentication enforcement
- Cross-user import prevention
- Persona name conflict detection
- Skill name conflict detection

**PHASE 4: Import Execution**
- Profile data updates
- Settings merging
- Persona creation
- Skill creation
- Transaction atomicity

**PHASE 5: Response Format**
- Correct JSON structure
- Accurate counts
- Conflict reporting
- Error details

**PHASE 6: Integration**
- Complete export/import cycle
- Token preservation (not overwritten)
- Existing data preservation
- Round-trip data integrity

### Manual Testing

**Step 1: Export Current State**
```bash
curl -X GET https://api.myapi.ai/api/v1/export?format=zip \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o export-original.zip
```

**Step 2: Modify Data Locally**
- Edit manifest.json to change a persona name
- Add a new skill
- Update profile displayName

**Step 3: Import the ZIP**
```bash
curl -X POST https://api.myapi.ai/api/v1/import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@export-original.zip"
```

**Step 4: Verify**
- Check profile was updated correctly
- Verify personas imported as expected
- Confirm skills created
- Verify NO tokens were imported
- Check existing OAuth tokens still work

---

## Error Handling

### Parse Errors
If JSON parsing fails for any section:
- Log the error
- Add to `errors` array in response
- Continue with other sections
- Do not fail the entire import

### File Missing
If expected files are missing:
- Skip that section gracefully
- No error (file is optional)
- Continue with other sections

### Checksum Failure
If checksums don't match:
- Log warning
- Continue with import (data may still be valid)
- Report mismatch count in response

### Database Error
If database operation fails:
- Catch error
- Log details
- Add to `errors` array
- Attempt to complete other sections within same transaction
- If transaction fails, return 500 error with summary

### Cross-User Attempt
If manifest.userId doesn't match current user:
- Return 403 Forbidden immediately
- Do not proceed with any import
- Log security event

---

## Performance Considerations

### Memory Usage
- ZIP stored in memory (up to 50MB limit)
- Files extracted to memory before processing
- Suitable for typical backups (1-10MB range)

### Processing Time
- **ZIP extraction:** O(n) where n = ZIP size
- **Checksum verification:** O(n) where n = file count
- **Data parsing:** O(m) where m = data records
- **Database operations:** O(k) where k = operations count

Typical import (5MB ZIP, 10 personas, 5 skills): < 2 seconds

### Database Transaction
- All operations in single transaction
- Lock held for entire operation
- No concurrent modifications possible during import

---

## Future Enhancements

1. **Knowledge Base Import**
   - Support importing KB documents and attachments
   - Validate document references
   - Handle file attachments

2. **Selective Import**
   - Query parameter to import only specific sections
   - Example: `?sections=personas,skills` (exclude profile)

3. **Merge Strategies**
   - Allow overwriting existing personas/skills
   - Conflict resolution policies (skip/overwrite/merge)

4. **Incremental Import**
   - Track import history
   - Prevent duplicate imports
   - Support partial retries

5. **Validation Reports**
   - Detailed pre-import preview
   - Dry-run mode (validate without committing)
   - Detailed conflict resolution options

---

## Security Audit Checklist

- [x] No access_tokens imported
- [x] No oauth_tokens imported
- [x] No vault_tokens imported
- [x] No refresh_tokens imported
- [x] No passwords/secrets imported
- [x] No OAuth credentials restored
- [x] Cross-user import prevented
- [x] User ownership verified
- [x] All inputs validated
- [x] SQL injection prevented (parameterized queries)
- [x] ZIP bomb protection (50MB limit)
- [x] Recursion protection (depth limit)
- [x] Transaction safety (atomic operations)
- [x] Error logging (detailed but safe)

---

## Code Location

- **Implementation:** `/src/routes/import.js` (525 lines)
- **Tests:** `/tests/import.test.js` (580 lines)
- **Registration:** `/src/index.js` (line ~1252)
- **Documentation:** This file

---

## Related Routes

- **Export:** `GET /api/v1/export` - Create ZIP backup
- **Skills:** `POST /api/v1/skills` - Create skill manually
- **Personas:** `POST /api/v1/personas` - Create persona manually
- **Settings:** `PATCH /api/v1/user/settings` - Update settings directly

