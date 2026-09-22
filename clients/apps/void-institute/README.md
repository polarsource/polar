# Void Institute

Short interactive lessons on how Void works, in the style of effect.institute:
one step at a time, a short prose card beside a code file that evolves, and a
scene that shows what the code does. Static content, no backend, no Void API
calls.

Nine chapters: Config, Events and reducers, Meters and products, Identities,
Ambient identity, Signals, LLM plugin, Local events, Deploy and versions. Each
chapter's definitions are built with the real SDK and compiled in its test, so
the code on screen cannot drift from `@void/sdk`.

## Run it

```bash
pnpm --filter void-institute dev   # http://127.0.0.1:3005
pnpm --filter void-institute test  # snippets compile against the real SDK
```

## Where things are

| File                       | What it is                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/lesson/types.ts`      | The contracts: a `Step` is prose, an optional full file, focus lines and an optional scene; a `Lesson` is steps.     |
| `src/lesson/highlight.ts`  | Server side. Runs Shiki once per distinct file and assigns line keys that survive across steps (`diff.ts`).          |
| `src/lesson/CodePanel.tsx` | One file animated between steps: kept lines slide, added lines fade in, removed lines collapse, unfocused lines dim. |
| `src/lesson/Lesson.tsx`    | Step state, arrow keys, progress bar, autoplay, `?step=` in the URL.                                                 |
| `src/content/*.tsx`        | One chapter per file. Code is a template string per step; the same definitions are built with the SDK for the scene. |
| `src/scenes/*.tsx`         | Client components a chapter renders beside its code.                                                                 |

A step that omits `code` keeps the previous step's file, so a chapter reads as a
sequence of edits. Each chapter has a vitest file that imports its definitions
and runs `compile()` so the code on screen cannot drift from the SDK.
