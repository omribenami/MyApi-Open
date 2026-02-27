# MyApi - API Examples

This document provides practical curl examples for every endpoint in the MyApi specification.

## Table of Contents

- [Authentication](#authentication)
- [Health Check](#health-check)
- [Identity Endpoints](#identity-endpoints)
- [Preferences](#preferences)
- [Token Management](#token-management)
- [Audit Logs](#audit-logs)
- [Connectors](#connectors)
- [Error Handling](#error-handling)

---

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header.

```bash
# Using a personal token
export PERSONAL_TOKEN="myapi_personal_abc123..."

# Using a guest token
export GUEST_TOKEN="myapi_guest_xyz789..."
```

---

## Health Check

### Check API Health

No authentication required.

```bash
curl -X GET \
  https://api.myapi.io/v1/health \
  -H 'Content-Type: application/json'
```

**Response:**
```json
{
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime": 86400,
    "components": {
      "vault": "healthy",
      "gateway": "healthy",
      "brain": "healthy",
      "database": "healthy"
    },
    "timestamp": "2026-02-18T21:00:00Z"
  },
  "meta": {
    "timestamp": "2026-02-18T21:00:00Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## Identity Endpoints

### Get Full Identity

Returns identity data filtered by token scope.

```bash
curl -X GET \
  https://api.myapi.io/v1/identity \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json'
```

**Response:**
```json
{
  "data": {
    "userId": "a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789",
    "name": "Ben-Ami",
    "email": "user@example.com",
    "professional": {
      "title": "Senior Software Engineer",
      "company": "TechCorp",
      "skills": ["Node.js", "Python", "Docker"],
      "links": {
        "github": "https://github.com/username",
        "linkedin": "https://linkedin.com/in/username"
      }
    },
    "personal": {
      "bio": "Tech enthusiast and builder",
      "location": "Chicago, IL",
      "timezone": "America/Chicago"
    },
    "scope": ["professional", "personal", "availability"]
  },
  "meta": {
    "timestamp": "2026-02-18T21:00:00Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "rateLimit": {
      "limit": 1000,
      "remaining": 999,
      "reset": 1708293600
    }
  }
}
```

### Get Professional Profile Only

```bash
curl -X GET \
  https://api.myapi.io/v1/identity/professional \
  -H 'Authorization: Bearer '"$GUEST_TOKEN" \
  -H 'Content-Type: application/json'
```

**Response:**
```json
{
  "data": {
    "title": "Senior Software Engineer",
    "company": "TechCorp",
    "skills": ["Node.js", "Python", "Docker", "Kubernetes"],
    "experience": [
      {
        "role": "Senior Software Engineer",
        "company": "TechCorp",
        "duration": "2022-present",
        "description": "Led development of microservices architecture"
      }
    ],
    "education": [
      {
        "degree": "BS Computer Science",
        "institution": "University of Example",
        "year": 2018
      }
    ],
    "links": {
      "linkedin": "https://linkedin.com/in/username",
      "github": "https://github.com/username",
      "website": "https://example.com"
    }
  },
  "meta": {
    "timestamp": "2026-02-18T21:00:00Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440001"
  }
}
```

### Get Availability and Calendar

```bash
curl -X GET \
  'https://api.myapi.io/v1/identity/availability?start=2026-02-19T00:00:00Z&end=2026-02-21T23:59:59Z&timezone=America/Chicago' \
  -H 'Authorization: Bearer '"$GUEST_TOKEN" \
  -H 'Content-Type: application/json'
```

**Response:**
```json
{
  "data": {
    "timezone": "America/Chicago",
    "workingHours": {
      "start": "09:00",
      "end": "17:00"
    },
    "preferredDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "upcomingEvents": [
      {
        "start": "2026-02-19T10:00:00-06:00",
        "end": "2026-02-19T11:00:00-06:00",
        "title": "Team Standup",
        "busy": true
      }
    ],
    "freeBusySlots": [
      {
        "start": "2026-02-19T09:00:00-06:00",
        "end": "2026-02-19T10:00:00-06:00",
        "status": "free"
      },
      {
        "start": "2026-02-19T10:00:00-06:00",
        "end": "2026-02-19T11:00:00-06:00",
        "status": "busy"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-02-18T21:00:00Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440002"
  }
}
```

---

## Preferences

### Get User Preferences

```bash
curl -X GET \
  https://api.myapi.io/v1/preferences \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json'
```

**Response:**
```json
{
  "data": {
    "communication": {
      "tone": "friendly",
      "verbosity": "normal",
      "language": "en-US"
    },
    "technical": {
      "preferredStack": ["Node.js", "Python", "Docker"],
      "codeStyle": "functional",
      "frameworks": ["Express", "FastAPI"]
    },
    "scheduling": {
      "meetingDuration": 30,
      "bufferTime": 15,
      "maxDailyMeetings": 5
    },
    "notifications": {
      "email": true,
      "push": true,
      "sms": false,
      "frequency": "hourly"
    }
  },
  "meta": {
    "timestamp": "2026-02-18T21:00:00Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440003"
  }
}
```

---

## Token Management

### List All Tokens

**Requires:** Personal token only

```bash
curl -X GET \
  https://api.myapi.io/v1/tokens \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json'
```

**Response:**
```json
{
  "data": [
    {
      "id": "b2c3d4e5-f6a7-4890-b123-c4d5e6f7a890",
      "type": "personal",
      "name": "Main Personal Token",
      "scope": ["*"],
      "createdAt": "2026-01-01T00:00:00Z",
      "expiresAt": null,
      "lastUsed": "2026-02-18T20:55:00Z",
      "usageCount": 1542
    },
    {
      "id": "c3d4e5f6-a7b8-4901-c234-d5e6f7a8b901",
      "type": "guest",
      "name": "Calendar Integration",
      "scope": ["identity:professional", "availability:read"],
      "createdAt": "2026-02-10T12:00:00Z",
      "expiresAt": "2026-03-10T12:00:00Z",
      "lastUsed": "2026-02-18T18:30:00Z",
      "usageCount": 42
    }
  ],
  "meta": {
    "timestamp": "2026-02-18T21:00:00Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440004"
  }
}
```

### List Tokens by Type

```bash
# List only guest tokens
curl -X GET \
  'https://api.myapi.io/v1/tokens?type=guest' \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json'
```

### Create a New Guest Token

**Requires:** Personal token only

```bash
curl -X POST \
  https://api.myapi.io/v1/tokens \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Third-party Calendar App",
    "scope": [
      "identity:professional",
      "availability:read"
    ],
    "expiresIn": 2592000
  }'
```

**Request Body:**
```json
{
  "name": "Third-party Calendar App",
  "scope": [
    "identity:professional",
    "availability:read"
  ],
  "expiresIn": 2592000
}
```

**Response:**
```json
{
  "data": {
    "id": "d4e5f6a7-b8c9-4012-d345-e6f7a8b9c012",
    "type": "guest",
    "name": "Third-party Calendar App",
    "scope": ["identity:professional", "availability:read"],
    "createdAt": "2026-02-18T21:00:00Z",
    "expiresAt": "2026-03-20T21:00:00Z",
    "lastUsed": null,
    "usageCount": 0,
    "token": "myapi_guest_abc123def456ghi789jkl012mno345pqr678..."
  },
  "meta": {
    "timestamp": "2026-02-18T21:00:00Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440005"
  }
}
```

**Note:** The `token` field is only returned when creating a new token. Store it securely!

### Create a Non-Expiring Token

```bash
curl -X POST \
  https://api.myapi.io/v1/tokens \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Long-lived Integration",
    "scope": ["identity:read", "connectors:read"],
    "expiresIn": null
  }'
```

### Revoke a Token

**Requires:** Personal token only

```bash
curl -X DELETE \
  https://api.myapi.io/v1/tokens/d4e5f6a7-b8c9-4012-d345-e6f7a8b9c012 \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json'
```

**Response:** 204 No Content (empty body)

---

## Audit Logs

### Get Audit Log (All Entries)

**Requires:** Personal token only

```bash
curl -X GET \
  https://api.myapi.io/v1/audit \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json'
```

**Response:**
```json
{
  "data": [
    {
      "id": "e5f6a7b8-c9d0-4123-e456-f7a8b9c0d123",
      "timestamp": "2026-02-18T20:55:00Z",
      "tokenId": "b2c3d4e5-f6a7-4890-b123-c4d5e6f7a890",
      "tokenType": "personal",
      "tokenName": "Main Personal Token",
      "action": "GET /api/v1/identity",
      "endpoint": "/api/v1/identity",
      "method": "GET",
      "statusCode": 200,
      "ipAddress": "192.168.1.100",
      "userAgent": "curl/7.68.0",
      "requestId": "550e8400-e29b-41d4-a716-446655440000",
      "scope": ["*"],
      "dataAccessed": ["identity.professional", "identity.personal", "identity.email"]
    },
    {
      "id": "f6a7b8c9-d0e1-4234-f567-a8b9c0d1e234",
      "timestamp": "2026-02-18T18:30:00Z",
      "tokenId": "c3d4e5f6-a7b8-4901-c234-d5e6f7a8b901",
      "tokenType": "guest",
      "tokenName": "Calendar Integration",
      "action": "GET /api/v1/identity/availability",
      "endpoint": "/api/v1/identity/availability",
      "method": "GET",
      "statusCode": 200,
      "ipAddress": "203.0.113.42",
      "userAgent": "CalendarApp/2.0",
      "requestId": "550e8400-e29b-41d4-a716-446655440002",
      "scope": ["identity:professional", "availability:read"],
      "dataAccessed": ["availability.freeBusySlots", "availability.upcomingEvents"]
    }
  ],
  "meta": {
    "timestamp": "2026-02-18T21:00:00Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440006",
    "pagination": {
      "page": 1,
      "pageSize": 50,
      "totalPages": 10,
      "totalItems": 487
    }
  }
}
```

### Get Audit Log with Pagination

```bash
curl -X GET \
  'https://api.myapi.io/v1/audit?page=2&pageSize=25' \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json'
```

### Filter Audit Log by Token

```bash
curl -X GET \
  'https://api.myapi.io/v1/audit?tokenId=c3d4e5f6-a7b8-4901-c234-d5e6f7a8b901' \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json'
```

### Filter Audit Log by Date Range

```bash
curl -X GET \
  'https://api.myapi.io/v1/audit?startDate=2026-02-01T00:00:00Z&endDate=2026-02-18T23:59:59Z' \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json'
```

### Filter Audit Log by Action

```bash
curl -X GET \
  'https://api.myapi.io/v1/audit?action=/api/v1/tokens' \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json'
```

### Combined Filters with Pagination

```bash
curl -X GET \
  'https://api.myapi.io/v1/audit?page=1&pageSize=10&tokenId=c3d4e5f6-a7b8-4901-c234-d5e6f7a8b901&startDate=2026-02-15T00:00:00Z' \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json'
```

---

## Connectors

### List All Connectors

```bash
curl -X GET \
  https://api.myapi.io/v1/connectors \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json'
```

**Response:**
```json
{
  "data": [
    {
      "id": "a7b8c9d0-e1f2-4345-a678-b9c0d1e2f345",
      "type": "github",
      "name": "GitHub Profile",
      "status": "active",
      "readOnly": true,
      "createdAt": "2026-01-15T10:00:00Z",
      "lastSync": "2026-02-18T20:00:00Z",
      "config": {
        "username": "octocat"
      }
    },
    {
      "id": "b8c9d0e1-f2a3-4456-b789-c0d1e2f3a456",
      "type": "calendar",
      "name": "Google Calendar",
      "status": "active",
      "readOnly": true,
      "createdAt": "2026-01-20T14:30:00Z",
      "lastSync": "2026-02-18T20:45:00Z",
      "config": {
        "calendarId": "primary"
      }
    }
  ],
  "meta": {
    "timestamp": "2026-02-18T21:00:00Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440007"
  }
}
```

### Filter Connectors by Type

```bash
curl -X GET \
  'https://api.myapi.io/v1/connectors?type=github' \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json'
```

### Filter Connectors by Status

```bash
curl -X GET \
  'https://api.myapi.io/v1/connectors?status=active' \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json'
```

### Add a GitHub Connector

**Requires:** Token with `connectors:write` scope

```bash
curl -X POST \
  https://api.myapi.io/v1/connectors \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "github",
    "name": "My GitHub",
    "config": {
      "username": "octocat",
      "apiToken": "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    }
  }'
```

**Response:**
```json
{
  "data": {
    "id": "c9d0e1f2-a3b4-4567-c890-d1e2f3a4b567",
    "type": "github",
    "name": "My GitHub",
    "status": "active",
    "readOnly": true,
    "createdAt": "2026-02-18T21:00:00Z",
    "lastSync": null,
    "config": {
      "username": "octocat"
    }
  },
  "meta": {
    "timestamp": "2026-02-18T21:00:00Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440008"
  }
}
```

**Note:** The API token is not returned in responses for security.

### Add a Calendar Connector

```bash
curl -X POST \
  https://api.myapi.io/v1/connectors \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "calendar",
    "name": "Work Calendar",
    "config": {
      "provider": "google",
      "calendarId": "work@company.com",
      "refreshToken": "1//xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    }
  }'
```

### Add a Custom Connector

```bash
curl -X POST \
  https://api.myapi.io/v1/connectors \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "custom",
    "name": "Personal Journal",
    "config": {
      "endpoint": "https://journal.example.com/api",
      "apiKey": "custom_key_xxxxxxxxxx",
      "syncInterval": 3600
    }
  }'
```

---

## Error Handling

### 401 Unauthorized - Missing Token

```bash
curl -X GET \
  https://api.myapi.io/v1/identity \
  -H 'Content-Type: application/json'
```

**Response:** 401 Unauthorized
```json
{
  "errors": [
    {
      "code": "UNAUTHORIZED",
      "message": "Authentication token is required"
    }
  ],
  "meta": {
    "timestamp": "2026-02-18T21:00:00Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440009"
  }
}
```

### 401 Unauthorized - Invalid Token

```bash
curl -X GET \
  https://api.myapi.io/v1/identity \
  -H 'Authorization: Bearer invalid_token_123' \
  -H 'Content-Type: application/json'
```

**Response:** 401 Unauthorized
```json
{
  "errors": [
    {
      "code": "UNAUTHORIZED",
      "message": "Invalid or expired token"
    }
  ],
  "meta": {
    "timestamp": "2026-02-18T21:00:00Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440010"
  }
}
```

### 403 Forbidden - Insufficient Scope

```bash
# Guest token trying to access audit logs
curl -X GET \
  https://api.myapi.io/v1/audit \
  -H 'Authorization: Bearer '"$GUEST_TOKEN" \
  -H 'Content-Type: application/json'
```

**Response:** 403 Forbidden
```json
{
  "errors": [
    {
      "code": "FORBIDDEN",
      "message": "Only personal tokens can access audit logs",
      "details": {
        "requiredScope": ["audit:read"],
        "requiredTokenType": "personal"
      }
    }
  ],
  "meta": {
    "timestamp": "2026-02-18T21:00:00Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440011"
  }
}
```

### 429 Rate Limit Exceeded

```bash
# After exceeding rate limit
curl -X GET \
  https://api.myapi.io/v1/identity \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json'
```

**Response:** 429 Too Many Requests
```json
{
  "errors": [
    {
      "code": "RATE_LIMIT_EXCEEDED",
      "message": "Rate limit exceeded. Please retry after the reset time.",
      "details": {
        "limit": 1000,
        "reset": 1708293600
      }
    }
  ],
  "meta": {
    "timestamp": "2026-02-18T21:00:00Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440012",
    "rateLimit": {
      "limit": 1000,
      "remaining": 0,
      "reset": 1708293600
    }
  }
}
```

**Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1708293600
Retry-After: 3600
```

### 400 Bad Request - Invalid Input

```bash
curl -X POST \
  https://api.myapi.io/v1/tokens \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "",
    "scope": []
  }'
```

**Response:** 400 Bad Request
```json
{
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "message": "Invalid request data",
      "details": {
        "name": "Token name cannot be empty",
        "scope": "At least one scope is required"
      }
    }
  ],
  "meta": {
    "timestamp": "2026-02-18T21:00:00Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440013"
  }
}
```

### 404 Not Found - Token Not Found

```bash
curl -X DELETE \
  https://api.myapi.io/v1/tokens/00000000-0000-0000-0000-000000000000 \
  -H 'Authorization: Bearer '"$PERSONAL_TOKEN" \
  -H 'Content-Type: application/json'
```

**Response:** 404 Not Found
```json
{
  "errors": [
    {
      "code": "NOT_FOUND",
      "message": "Token not found",
      "details": {
        "tokenId": "00000000-0000-0000-0000-000000000000"
      }
    }
  ],
  "meta": {
    "timestamp": "2026-02-18T21:00:00Z",
    "version": "1.0.0",
    "requestId": "550e8400-e29b-41d4-a716-446655440014"
  }
}
```

---

## Rate Limit Headers

All authenticated endpoints return rate limit information in response headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1708293600
```

- **X-RateLimit-Limit**: Maximum requests per window
- **X-RateLimit-Remaining**: Requests remaining in current window
- **X-RateLimit-Reset**: Unix timestamp when the rate limit resets

---

## Available Scopes

When creating guest tokens, use these scopes:

- `identity:read` - Basic identity info
- `identity:professional` - Professional profile access
- `identity:personal` - Personal info access
- `availability:read` - Calendar and availability data
- `preferences:read` - User preferences
- `connectors:read` - List connectors
- `connectors:write` - Add/remove connectors
- `audit:read` - View audit logs (personal token only)
- `tokens:read` - List tokens (personal token only)
- `tokens:write` - Create/revoke tokens (personal token only)

Personal tokens have scope `["*"]` (full access).

---

## Best Practices

1. **Store tokens securely**: Never commit tokens to version control
2. **Use appropriate scopes**: Grant minimal required permissions
3. **Monitor audit logs**: Regularly review API access
4. **Respect rate limits**: Implement exponential backoff
5. **Handle errors gracefully**: Check status codes and error messages
6. **Use HTTPS**: Always use HTTPS in production
7. **Rotate tokens**: Regularly rotate guest tokens
8. **Set expiration**: Use `expiresIn` for temporary access

---

## Environment Variables

Set up your environment for easier testing:

```bash
# Personal token (full access)
export PERSONAL_TOKEN="myapi_personal_abc123..."

# Guest token (scoped access)
export GUEST_TOKEN="myapi_guest_xyz789..."

# API base URL
export API_BASE_URL="https://api.myapi.io/v1"

# Example with environment variables
curl -X GET \
  "${API_BASE_URL}/identity" \
  -H "Authorization: Bearer ${PERSONAL_TOKEN}" \
  -H 'Content-Type: application/json'
```

---

## Testing Workflow

### 1. Check API Health
```bash
curl -X GET "${API_BASE_URL}/health"
```

### 2. Get Your Identity
```bash
curl -X GET "${API_BASE_URL}/identity" \
  -H "Authorization: Bearer ${PERSONAL_TOKEN}"
```

### 3. Create a Guest Token
```bash
curl -X POST "${API_BASE_URL}/tokens" \
  -H "Authorization: Bearer ${PERSONAL_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test Token",
    "scope": ["identity:professional"],
    "expiresIn": 3600
  }'
```

### 4. Test Guest Token Access
```bash
# Save the token from step 3
export TEST_GUEST_TOKEN="myapi_guest_..."

# Try accessing professional profile (should work)
curl -X GET "${API_BASE_URL}/identity/professional" \
  -H "Authorization: Bearer ${TEST_GUEST_TOKEN}"

# Try accessing audit logs (should fail - 403)
curl -X GET "${API_BASE_URL}/audit" \
  -H "Authorization: Bearer ${TEST_GUEST_TOKEN}"
```

### 5. Review Audit Log
```bash
curl -X GET "${API_BASE_URL}/audit" \
  -H "Authorization: Bearer ${PERSONAL_TOKEN}"
```

### 6. Revoke Test Token
```bash
# Use the token ID from step 3
curl -X DELETE "${API_BASE_URL}/tokens/<token-id>" \
  -H "Authorization: Bearer ${PERSONAL_TOKEN}"
```

---

## Support

For questions or issues, contact support or consult the full API specification at `/docs/API_SPEC.yaml`.
