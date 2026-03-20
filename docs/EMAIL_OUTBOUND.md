# Outbound Email (MyApi)

MyApi supports **outbound email only** (no inbox read/search).

## Required environment variables

```env
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@myapiai.com
EMAIL_FROM_NAME=MyApi
```

> `EMAIL_FROM` is mandatory and sourced from environment configuration only (not hardcoded in code).
>
> Required deployment value: `EMAIL_FROM=noreply@myapiai.com` (you may override per environment if needed).

### SMTP mode

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_SECURE=false
```

### SendGrid mode (optional)

```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
```

## Operational endpoints

All endpoints are outbound-only and require admin scope (or internal key for processing):

- `GET /api/v1/email/status` – provider + queue health
- `GET /api/v1/email/jobs?limit=20&status=pending|sent|failed` – recent queue jobs
- `POST /api/v1/email/process` – process pending queue items
- `GET /api/v1/email/test` – verify transport configuration
- `POST /api/v1/email/send-test` – send test email (`{ "to": "user@example.com" }`)

## Queue visibility

Queue status and failures are exposed via:

- `/api/v1/email/status` (`queue` object, including `lastFailure`)
- `/api/v1/email/jobs` (`failedReason`, `status`, timestamps)
