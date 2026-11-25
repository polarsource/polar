# Report a vulnerability

Polar welcomes reports of security vulnerabilities in its products and systems. This page explains how to report one, what's in scope, and how to test responsibly.

## Making a report

If you've found an issue you believe is in scope, report it through a [GitHub Security Advisory](https://github.com/polarsource/polar/security/advisories/new). Include:

- A clear summary of the issue and its potential impact.
- Detailed steps to reproduce the issue.
- Relevant environmental details (browser, OS, version numbers, etc.).
- Any proof-of-concept code that demonstrates the vulnerability, if available.

Please submit findings you've personally investigated and verified. We discourage entirely AI-generated reports, which will likely receive lower priority during triage.

Our security team will review your report and keep you updated on our progress, requesting additional information or clarification when needed.

We may offer compensation, at our discretion, for reports that lead to a confirmed vulnerability.

## Timeline

We'll get back to you within a few days to acknowledge your report.

## What we're most interested in

- Authentication bypass and privilege escalation.
- Exposure of personally identifiable information (PII).
- Unauthenticated access to user data (outside of intentionally public data).

## In scope

- [https://polar.sh](https://polar.sh)
- [https://api.polar.sh](https://api.polar.sh)

## Out of scope

- Race conditions, including time-of-check to time-of-use (TOCTOU) findings.
- Automated scanning.
- Social engineering.
- Denial of Service attacks.
- Attacks that need physical access to someone's computer.
- Theoretical attacks you can't actually exploit.
- Man-in-the-middle attacks.
- Clickjacking or UI redress attacks.
- CSV injection.
- HTML injection.
- Missing security headers, weak TLS cipher suites, or DNS setup issues. We might find these informative, but they're unlikely to qualify for compensation.

## Please be considerate while investigating

- Only test with your own account (or get permission from the account owner first).
- Don't modify, delete, or store private data that isn't yours.
- Avoid anything that might break or slow down our services.
- If you get remote access to our systems, don't try to expand or elevate your access.
