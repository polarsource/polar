# Post-deployment PII validation

The `validate-logs` job in `.github/workflows/deploy-environment.yml` runs after a
successful backend deployment and frontend promotion (or a skipped frontend).
Configure the read credentials below before shipping the workflow change: missing
configuration fails the workflow.

## Flow

1. GitHub starts a Render one-off job using the deployed API service's build and environment.
2. `scripts.emit_pii_validation` checks its release, then calls the same
   `configure_sentry()`, `configure_logfire("server")`, and
   `configure_logging(logfire=True)` functions as the API.
3. The script emits synthetic structured fields, a stdlib message, an exception,
   a direct Logfire record, and a Sentry error with a breadcrumb. It flushes the
   exporters before printing a safe manifest and exiting.
4. GitHub retrieves that manifest from the job's stored Render logs. It checks the
   release/environment and requires Logfire, S3, and Sentry to be enabled.
5. The verifier reads the **one-off job's** Render logs, Logfire rows, S3 gzip
   batches, and the Sentry event. It scans full returned payloads, including nested
   metadata, for the original synthetic values. Every expected case must arrive
   with redaction markers and its safe customer UUID intact; exception details
   must retain `ValueError`. A complete sample is checked for another 30 seconds
   to catch delayed duplicates.
6. Sanitized JSON and Markdown reports are uploaded to the deployment workflow for
   90 days. The Markdown report also appears in the job summary. Reports contain
   field names and counts, never raw payloads or sensitive test values.

There is no endpoint, organization token, Redis handoff, or worker task. The script
uses the deployed logging configuration in a separate process; it does not exercise
live API requests, request middleware, worker execution, individual replicas,
frontend telemetry, or PostHog. It does not change billing data or send email.

The validation deadline is 15 minutes, with a 20-minute GitHub job timeout. Missing
events, failed jobs, permission errors, malformed responses, truncated queries,
and query-size limits fail validation. CLI error boundaries report the exception
type and stage/destination, not raw response bodies.

A failed sandbox validation blocks production through the existing workflow
dependency. Production failures use the existing deployment failure notification.
There is no automatic rollback. Tracking tags still advance for components that
actually deployed successfully.

## Provisioning (per GitHub Environment)

The job uses the protected `sandbox`, `production`, or `test` GitHub Environment.
Its protection rules apply, including any additional approval required when this
post-deployment job becomes ready.

| Secret                              | Access needed                                                                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PII_VALIDATION_LOGFIRE_READ_TOKEN` | Read token for the environment's Logfire project. The SDK selects its region from the token.                                                                                                                                    |
| `PII_VALIDATION_SENTRY_READ_TOKEN`  | `event:read` for the backend Sentry project. Keep separate from the release-management token.                                                                                                                                   |
| `PII_VALIDATION_AWS_ROLE_ARN`       | GitHub OIDC role restricted to this repository/environment, with `s3:ListBucket` on the logs bucket (prefix `spans/*`) and `s3:GetObject` on its `spans/*` objects. Add `kms:Decrypt` only for customer-managed KMS encryption. |

The existing `RENDER_API_TOKEN` creates/reads one-off jobs and reads logs; the
existing `SENTRY_ORG` identifies the Sentry organization. The Render job inherits
the API's normal exporter credentials and needs none of these read credentials.

Environment variables:

- `PII_VALIDATION_RENDER_OWNER_ID`: Render workspace ID owning the API service.
- `PII_VALIDATION_SENTRY_PROJECT`: backend Sentry project slug (normally `server`).

All four destinations are required. Disabled exporters must fail, not silently
skip validation. Do not put credentials in the Render job's `startCommand` or Git.

## Manual run

From `server/`, with the same read credentials exported and AWS credentials for the
environment's logs bucket:

```sh
uv run python -m scripts.validate_pii \
  --release <full-deployed-git-sha> \
  --environment sandbox \
  --service-id <render-api-service-id> \
  --output /tmp/pii-validation.json
```

This starts a one-off job and emits real synthetic telemetry in the selected
environment. Each run uses a new UUID, so old records cannot satisfy a new check.
Synthetic Sentry errors share the `pii-validation` fingerprint; do not discard them
at ingestion or validation fails.

## Limits

S3 reads cache seen objects and fail if a prefix query is truncated, a batch
exceeds 32 MiB decompressed, compressed input exceeds 64 MiB, or total decompressed
input exceeds 256 MiB. Render/Logfire/S3 record limits are 1,000. Exceeding a bound
is an incomplete check, not evidence of clean logs.

Synthetic cases in `cases.py` are independent of the scrubber's sensitive-key list.
Extend them for new fields or shapes. A passing sample is not proof that arbitrary
PII cannot escape. Hosted destination settings can also redact values: this check
validates stored output, while integration tests verify application-side scrubbing.
