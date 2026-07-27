# Polar Code Review

Review the diff against Polar-specific rules that the built-in reviewers cannot know:
conventions and Accepted ADRs.

This command does NOT hunt for bugs, security issues, or generic simplifications. Those are
covered better by the built-in `/code-review`, `/security-review`, and `/simplify` (they verify
findings and can apply fixes). This command adds the one thing they lack: knowledge of Polar's
own patterns and architecture decisions.

## Instructions

1. **Get the diff** against main:
   ```bash
   git diff main...HEAD
   ```
   If that fails, use `git diff HEAD~1` or ask the user for the comparison base. Keep both the
   file list and the full diff. You will pass the diff to the agents, not just file names.

2. **List the Accepted ADRs** so the ADR agent knows what to check:
   ```bash
   ls handbook/engineering/decisions/
   ```

3. **Launch 2 agents IN PARALLEL** using the Task tool. Both must be launched in a SINGLE message
   with two Task tool calls. Give each agent the full diff from step 1.

   The two agents must NOT overlap. Agent 2 owns everything covered by an Accepted ADR. Agent 1
   only checks conventions that no ADR covers. If a rule is in an ADR, leave it to Agent 2.

### Agent 1: Conventions Review

```
description: "Conventions review"
subagent_type: "feature-dev:code-reviewer"
prompt: |
  CONVENTIONS REVIEW for the Polar codebase.

  Review this diff against Polar conventions. Only the changed lines are in scope.

  [INSERT FULL DIFF]

  These rules are NOT covered by an ADR. Do not check ADR topics here (errors, transactions,
  auth, Orbit Box, output schema defaults, migrations). Another agent owns those.

  **Backend (server/polar/):**
  - All DB queries live in repository files, not services.
  - Services are singletons: instance at module level, e.g. `resource = ResourceService()`.
  - Use AsyncReadSession for reads, AsyncSession for writes.
  - Pydantic schemas: separate read, create, and update schemas.
  - Update (input) schemas: every field optional with a None default.
  - Create repositories with `from_session(session)`.
  - Relationships use lazy="raise". Load what you need explicitly.
  - Endpoints return ORM models, not hand-built dicts.

  **Frontend (clients/):**
  - TanStack Query for data fetching. Zustand for client state.
  - New translatable strings go only in clients/packages/i18n/src/locales/en.ts.
  - Keep files under the 250-line max-lines limit.

  **API:**
  - POST returns 201. PATCH returns 200. DELETE returns 204.
  - List endpoints return ListResource with pagination.
  - Use PolarRequestValidationError for 422 errors.
  - API fields are snake_case.

  Report each violation with a file:line reference, the rule it breaks, and the fix.
  Only report HIGH-confidence violations. Do not nitpick style or flag unchanged code.
```

### Agent 2: ADR Compliance

```
description: "ADR compliance"
subagent_type: "feature-dev:code-reviewer"
prompt: |
  ADR COMPLIANCE REVIEW for the Polar codebase.

  Accepted ADRs live in handbook/engineering/decisions/. Read the index at
  handbook/engineering/decisions/index.mdx and any ADR that looks relevant to this diff.

  Review this diff. Only the changed lines are in scope.

  [INSERT FULL DIFF]

  For each change, check whether it contradicts an Accepted ADR. If it does, report:
  - file:line reference
  - the ADR id and title it violates (e.g. "violates ADR-0002")
  - a short explanation of the conflict
  - the fix, or a note that a new ADR may be needed

  Only report HIGH-confidence conflicts. If nothing conflicts, say so.
```

4. **Wait for both agents to complete**, then summarize.

## Summary Format

---

## Polar Review Summary

### 🟡 Convention Violations
[Findings from Agent 1, or "None found"]
- [rule broken] - `file:line` - [fix]

### 📐 ADR Conflicts
[Findings from Agent 2, or "None found"]
- **violates ADR-XXXX**: [explanation] - `file:line`

### Verdict

**✅ APPROVED** - No Polar-specific issues found
or
**❌ CHANGES REQUESTED** - [number] issues to address

---

Any ADR conflict makes the verdict CHANGES REQUESTED.
