# Po Bot

A small Grok Bot-style app: one organization, its members, and each member's
reusable agents. It exists to show three things about Void.

1. **Billing identities.** The organization is the customer and the root. Each
   member is an identity under it with a credit cap; each agent is an identity
   under its member. Every completion an agent makes rolls up to the member and
   to the organization, and the member's cap is enforced before the model runs.
2. **The `llm` plugin.** Agents run on the model they were created with. The
   route wraps that model with `scope.ai.model(...)`, which gates the call on
   the credits left and records one completion event with tokens, credits and
   gateway cost.
3. **Config as code.** `void.ts` is the whole billing model: the plugin in
   credits mode with a rate per model, and one product that includes credits.

The UI is built on Orbit, Polar's design system, so it looks like the rest of
the dashboard. Layout is `Box`, copy is `Text`, and the buttons, inputs, pills
and avatars are the shared components.

## Run it

Po Bot talks to Polar's Void API (`/v1/void`), so start the Polar stack first.
From the repo root:

```bash
dev up --void
dev seed
dev start
```

The Polar seed creates a dedicated `po-bot` organization with Void enabled.
Sign in at http://127.0.0.1:3000 as `void@polar.sh` (login code in the API
pane) and pick `po-bot`.

Then, from this directory:

```bash
cp .env.template .env.local   # fill in AI_GATEWAY_API_KEY if you want chat
pnpm void login --api-url http://127.0.0.1:8000
# Sign in as void@polar.sh and pick po-bot
pnpm bootstrap               # void deploy --activate, create the app database, subscribe the org
pnpm dev                     # http://127.0.0.1:3004
```

Po Bot uses the active `void login` profile. Leave `VOID_TOKEN` unset in
`.env.local` so the saved login is used. `VOID_TOKEN` is only for CI.

The organization's `void_enabled` feature flag must be set; see
[`packages/void-sdk/README.md`](../../packages/void-sdk/README.md#try-login-locally).

`pnpm bootstrap` is safe to run again. `pnpm reset` deletes both SQLite files;
the identities and events already on the server stay.

## Where things are

| File                           | What it is                                                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `void.ts`                      | The billing model: models, rates, the team plan.                                                                                                      |
| `src/void.ts`                  | Every call the app makes to Void: spawn a member with a cap, spawn an agent, the agent's metered model, credits per identity, the latest completions. |
| `src/channels.ts`              | The shape of the live state: the identity tree with standings, the completion log, judgments, activities. Shared by server and browser.               |
| `src/live.ts`                  | One broadcaster per process: each channel reloads on its own beat and is sent only when it changed; `publish` pushes what this process just saw.      |
| `src/activity.ts`              | Scope those completions to one chat and fold Jev's labels into a mix.                                                                                 |
| `src/db/schema.ts`             | The app's own tables: members, agents, messages.                                                                                                      |
| `src/actions.ts`               | Creating a member or agent: insert the row, then one call into `src/void.ts`.                                                                         |
| `src/tools.ts`                 | Shared tools every agent can call: web, files, a code sandbox, email. Implementations are mocked.                                                     |
| `src/app/api/chat/route.ts`    | `streamText` on the agent's metered model, with the shared tools. The model's hooks publish the call and its completion the moment they happen.       |
| `src/app/api/live/route.ts`    | Server-sent events: one named event per channel as it changes, plus `live` events for calls starting and completions landing.                         |
| `src/hooks/live.ts`            | The browser side: channels land in the query cache, a completion bumps standings and pulses the tree before Void confirms it.                        |
| `src/components/Workspace.tsx` | The member page's frame: sidebar, chat, event panel, and the tree along the bottom. The panel and tree are dragged to size.                           |
| `src/components/Hierarchy.tsx` | The tree along the bottom. A completion climbs from its agent to the member to the org as the credits fold into each.                                 |
| `src/setup.ts`                 | Make the organization a customer and subscribe it, after `void deploy`.                                                                               |

The app's database is `data/app.db` (Drizzle over libsql). The SDK keeps its
own event storage in `data/void.db`; events are written there first and
shipped to the server, and the check counts them before they land.
