# Polar Code Review

Review the diff against the things only Polar knows: its conventions, its Accepted ADRs, its
shared helpers, its API contract, its deploy shape, its billing domain.

Not a bug hunt and not a security review — `/code-review` and `/security-review` do those
better, and they verify findings and can apply fixes. This adds what they cannot know.

This is only a router. Every lens is a skill you can also run on its own.

## 1. Diff

```bash
git status --short
git diff main...HEAD --stat
git diff main...HEAD
```

Require a clean working tree. Keep the full diff — every lens reviews changed lines, not
just file names.

## 2. Route

Run the first four always. Add the rest only when the trigger matches.

| Skill | Runs when |
|---|---|
| `conventions-check` | always |
| `adr-check` | always |
| `reuse-check` | always |
| `slop-check` | always |
| `api-surface-review` | `**/schemas.py`, `**/endpoints.py`, `polar/openapi.py`, `docs/openapi.json`, `sdk/`, `clients/packages/client/` |
| `ship-safety` | `migrations/versions/`, `**/tasks.py`, `polar/models/`, `server/scripts/`; an endpoint is removed; or the diff spans `server/` and `clients/` with a dependency between them |
| `billing-review` | the billing paths listed in that skill's Scope section |

## 3. Launch

Launch all selected lenses concurrently in one message using the environment's subagent
tool. Do not serialize independent reviews. Each lens gets this task:

```
Read `.agents/skills/<skill name>/SKILL.md` and follow it exactly.

From the repository root, run `git diff main...HEAD` to get the complete diff.
Only changed lines are in scope — never the rest of the repo.

Use the output format the skill defines. High-confidence findings only. If you are unsure
whether something is a defect, put it under Question instead of asserting it.
```

Each skill declares what it does **not** own, so the lenses do not overlap by construction.

`adr-check` predates this command and has its own terser format: either `No violations`, or a
list of ADR id, `file:line`, what breaks, and the fix. Map its findings to 🔴.

## 4. Merge

- **Deduplicate.** One line, one finding. Precedence when two lenses hit the same line:
  `billing-review` → `api-surface-review` → `ship-safety` → `adr-check` →
  `conventions-check` → `reuse-check` → `slop-check`.
- **Surface conflicts.** If two lenses disagree, say so rather than picking silently.
- **Cut the padding.** A short report that is all true beats a long one that is half true.
- **Re-review precisely.** After fixes, run only the lenses that raised findings.

## 5. Report

```markdown
## Polar Review

### 🔴 Blocking
- **[lens]** `file:line` — <what breaks>. Fix: <fix>

### 🟠 Should fix
- **[lens]** `file:line` — <claim>. Fix: <fix>

### 🟡 Questions
- **[lens]** `file:line` — <question>

### 🧹 Delete
- `file:line-line` — <why>

### Notes
<deploy notes from ship-safety, surface delta from api-surface-review. Omit if neither ran.>

### Coverage
Ran: <...>. Skipped: <...> (no matching paths).

### Verdict
✅ APPROVED  |  ❌ CHANGES REQUESTED — n blocking, n should-fix
```

Any unresolved 🔴 or 🟠 means CHANGES REQUESTED. 🟡 questions do not block the PR.
