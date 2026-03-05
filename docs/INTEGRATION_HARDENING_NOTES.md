# Integration Hardening Notes

## Patterns applied

- **Standardized service contract**: every service response normalized with consistent fields.
- **Method-level validation**: rejects unknown methods and invalid `params` shape early.
- **Retry envelope for transient faults**: exponential backoff + jitter semantics in execution layer.
- **Error normalization**: consistent `error.code`, `error.message`, `retryable`, and `statusCode`.
- **Service metadata normalization**: category/auth/docs/api base/method metadata all emitted from one path.
- **Backward compatibility**: kept existing endpoint routes and retained `status: executed|failed` wrapper.

## Security and reliability checklist

- Keep OAuth state token validation strict and short-lived.
- Prefer HTTPS redirect URIs in production.
- Store secrets in env/secret store, not committed files.
- Treat 429/5xx/network errors as retryable; avoid retrying 4xx validation/auth errors.
- Preserve audit logs for authorize/callback/disconnect/test/execute paths.
- Ensure auth type drives required connection check (`oauth2`/`token` require connection, `webhook/none` may not).

## Remaining gaps (future)

- Real provider SDK/API calls per service method (currently execution is normalized/simulated envelope).
- Per-provider rate-limit adapters honoring provider-specific `Retry-After` headers.
- Optional circuit-breaker and dead-letter queue for repeated provider outages.
- Token refresh workflows for providers with refresh token rotation.
