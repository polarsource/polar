---
name: slop-check
description: Strip agent-generated noise from a diff — comments that restate the code, private helpers in test files, near-duplicate tests, tests with no assertions, unrequested indexes and validation, defensive guards that duplicate an existing check. Use before opening a PR on agent-written code, or when the user asks to tighten a diff, remove slop, or cut verbose comments.
license: MIT
metadata:
  author: polar
  version: "1.0.0"
---

# Slop Check (Polar)

The handle is the **diff**. The evidence is **lines that should not exist**.

Not a bug hunt, not a style guide. One job: delete code that is recognisably agent-written
and that a Polar reviewer would ask you to remove. Run it before the other lenses, because
everything it cuts is diff nobody else has to read.

Calibration, from real reviews:

> "Verbosy LLM comment" · "Meaningless slop comment imho, let's drop" · "That's typical of
> Claude, it puts those private helper functions everywhere!" · "Lol, LLM was zealous here" ·
> "This feels like a new thing that Claude always wants to throw in" · "Overengineering IMO,
> that case would be at most rare"

## Scope

Any diff. It is cheap, there is no reason to skip it.

Owned elsewhere: reinvented helpers → `reuse-check`; written conventions → `conventions-check`.

## Checks

Propose a deletion, not a rewrite, wherever a deletion will do.

**1. Comments that restate the code.** The repo rule is: no comments unless necessary, the
code should be self-explanatory. Comment the non-obvious *why*, never the *what*.
Endpoint docstrings are not slop — they render into OpenAPI — but strip implementation
detail out of them.

**2. Private helpers in test files.** The strongest agent tell here. `_make_auth_subject()`
or `_create_order(...)` at the top of a test module instead of the fixtures. If a helper is
genuinely needed it is a pytest fixture. Also flag `save_fixture` called twice on one object,
and re-setting data a fixture already provides.

**3. Near-duplicate tests.** Agents write one test per input permutation. Flag any group in
the diff that differs only by an input value and asserts the same branch, and say which to
keep.

**4. Tests that assert nothing.** A test body with no `assert` / `expect` always passes.
Grep every new test.

**5. Unrequested extras.** An index nobody asked for, validation the type already enforces, a
config flag with one caller, an abstraction with one implementation, a `try/except` for
something the framework handles, an overload that changes no behaviour. Ask of each: *what
breaks if this is deleted?* If nothing, delete it.

**6. Guards that duplicate an existing check.** Defensive code repeating an upstream check, or
guarding a case the data model makes impossible. Also a superfluous `session.flush()` —
flushing is only for data that must be visible before the request ends.

**7. Dead on arrival.** Added in the diff but nothing calls it: unused argument, unused
import, method with no caller, `getattr` where attribute access works, a wrapper that only
forwards.

## Do not flag

Two ways this check goes wrong, both worse than the slop itself.

- **Domain comments.** A comment explaining why a lock is released only on the webhook path,
  or why a status maps to Stripe's `lost`, is exactly what the team wants. The test is whether
  the sentence carries information the code cannot.
- **Real coverage.** Only flag a test that duplicates another test *in this diff*, or that
  asserts nothing. Cutting coverage to hit a "fewer tests" target is a worse outcome.

## Output

```
## Slop

### 🟠 Delete
- `file:line-line` — <why>

### 🟡 Question
- `file:line` — <question, e.g. "index added but the task did not ask for one. What query needs it?">

### Verdict
✅ Clean  |  ❌ n lines to remove
```

Group by file and give line ranges, so the author can act without re-reading the diff.
