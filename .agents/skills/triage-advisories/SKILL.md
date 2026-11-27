---
name: triage-advisories
description: Triage private GitHub security reports for polarsource/polar, close clear policy exclusions with explanations, and give the maintainer concise severity assessments for the remaining reports.
---

# Triage Polar security advisories

## Review the queue

- Use the authenticated GitHub repository advisory API (`gh api repos/polarsource/polar/security-advisories`). Paginate through `triage` and `draft` for a full review. For a new batch, compare with the previous review so already tracked reports stay out of the batch.
- Read Polar's current `SECURITY.md` on `main`, each report and its follow-ups, and the relevant code on current `main`. Split independent reports among subagents for larger batches. Keep reports private and delegate read-only review. Verify claims from code and reporter evidence without replaying exploits or probing live services.
- Assess the actual access boundary, prerequisites, and impact. Check whether a fix has already merged. A report about a timing window can also contain a separate defect that works without that window. Distinguish access a bearer credential is meant to grant from credential leakage or authority beyond its scope.

## Disposition

- When asked to triage the queue, close clear `Out of scope` findings. Post an individual comment explaining why the exclusion applies, link the [policy](https://github.com/polarsource/polar/blob/main/SECURITY.md#out-of-scope), then close and verify the state on GitHub. Leave ambiguous reports open and name the missing evidence.
- Leave valid reports open for the maintainer's decision. Flag duplicates, expected behavior, and already-fixed findings. Close these when asked, with the existing advisory or verified PR or commit where applicable. Say whether the fix is merged or pending. When asked to include the AI policy, [link it](https://github.com/polarsource/polar/blob/main/SECURITY.md#making-a-report) and remind reporters to verify findings personally. The policy discourages entirely AI-generated reports, which may receive lower triage priority.
- Start fixes, open PRs, create tickets, and change GitHub severity only when requested. If asked to fix multiple findings, use one focused PR per finding with a concise explanation of the faulty path and fix. Add a small flow diagram only if it clarifies the path.

## Report back

Give the counts reviewed, closed, and left open. Link verified closures. For each remaining finding, give an independently assessed severity and one plain-language sentence covering the actual impact and any important prerequisite. State material uncertainty, including provider or production behavior that source review cannot verify.
