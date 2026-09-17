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

The organization needs its own Polar organization with Void enabled, and a
token for it, since an organization holds one deployed config. From `server/`:

```bash
uv run python -m scripts.generate_void_token <organization-uuid-or-slug> --customers
```

The organization's `void_enabled` feature flag must be set; see
[`packages/void-sdk/README.md`](../../packages/void-sdk/README.md#try-login-locally).

Then, from this directory:

```bash
cp .env.example .env.local   # fill in VOID_TOKEN and AI_GATEWAY_API_KEY
pnpm bootstrap               # void deploy --activate, create the app database, subscribe the org
pnpm dev                     # http://localhost:3004
```

`pnpm bootstrap` is safe to run again. `pnpm reset` deletes both SQLite files;
the identities and events already on the server stay.

## Where things are

| File                           | What it is                                                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `void.ts`                      | The billing model: models, rates, the team plan.                                                                                                      |
| `src/void.ts`                  | Every call the app makes to Void: spawn a member with a cap, spawn an agent, the agent's metered model, credits per identity, the latest completions. |
| `src/live.ts`                  | One frame of the organization: the identity tree with every node's standing, and the latest completions.                                              |
| `src/db/schema.ts`             | The app's own tables: members, agents, messages.                                                                                                      |
| `src/actions.ts`               | Creating a member or agent: insert the row, then one call into `src/void.ts`.                                                                         |
| `src/app/api/chat/route.ts`    | Plain `streamText` on the agent's metered model.                                                                                                      |
| `src/app/api/live/route.ts`    | Server-sent events: a fresh frame every two seconds.                                                                                                  |
| `src/components/Workspace.tsx` | The member page's frame: sidebar, chat, event panel, and the tree along the bottom. The panel and tree are dragged to size.                           |
| `src/components/Hierarchy.tsx` | The tree along the bottom. A completion climbs from its agent to the member to the org as the credits fold into each.                                 |
| `src/setup.ts`                 | Make the organization a customer and subscribe it, after `void deploy`.                                                                               |

The app's database is `data/app.db` (Drizzle over libsql). The SDK keeps its
own event storage in `data/void.db`; events are written there first and
shipped to the server, and the check counts them before they land.
