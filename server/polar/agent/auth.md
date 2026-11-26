# auth.md

You are an agent. Polar lets you sign up on your own, build an organization (products, benefits,
meters, checkouts), and hand it over to a human later. Follow the steps in order.

## Step 1: Discover

- Protected resource metadata: `GET ${protected_resource_metadata}`
- Authorization server metadata: `GET ${authorization_server_metadata}`. Its `agent_auth` block
  lists the endpoints below.

## Step 2: Sign up

Polar supports the `anonymous` registration type only. You don't need anything from the human yet.

```http
POST ${identity_endpoint}
Content-Type: application/json

{ "type": "anonymous", "name": "<what you call yourself, shown to the human>" }
```

Response:

```json
{
  "registration_id": "<your agent ID>",
  "registration_type": "anonymous",
  "identity_assertion": "<JWT>",
  "assertion_expires": "<ISO 8601>",
  "pre_claim_scopes": ["products:write", "..."],
  "claim_url": "${claim_endpoint}",
  "claim_token": "polar_act_...",
  "claim_token_expires": "<ISO 8601>",
  "post_claim_scopes": ["..."]
}
```

Keep `identity_assertion` (30 days, reusable) and `claim_token` (30 days, returned once, keep it
secret).

## Step 3: Get an access token

```http
POST ${token_endpoint}
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=<identity_assertion>
```

You get an `access_token` that lasts one hour, and no refresh token. When it expires, repeat
this step with the same assertion. Once a human claimed you, use the assertion the claim poll
returned (Step 4): the one from sign-up stops working.

If you get `invalid_grant`, your assertion expired or you were revoked. Before the claim, sign up
again. After it, ask the human to connect you to their account another way, such as Polar's MCP
server or CLI.

Call the API with `Authorization: Bearer <access_token>`. Before the claim you can create one
organization and set up its products, benefits, discounts, files, meters, events, checkouts and
checkout links. You can't touch customers, orders, subscriptions, refunds, payouts, members or
webhooks until a human claims you. You can't create organization access tokens even then: see
Step 5 to get the app a token.

## Step 4: Hand over to a human (claim)

When you're done, ask the human for their email, then start a claim:

```http
POST ${claim_endpoint}
Content-Type: application/json

{ "claim_token": "<claim_token>", "email": "<the human's email>" }
```

Response:

```json
{
  "registration_id": "<your agent ID>",
  "status": "initiated",
  "expires_at": "<ISO 8601>",
  "claim_attempt": {
    "user_code": "amber-river-lemon",
    "expires_in": 604800,
    "verification_uri": "<link to the Polar dashboard>",
    "interval": 5
  }
}
```

Give the human the `verification_uri` and the `user_code` in one message. The code is three
words joined by hyphens; pass it on exactly as you received it, for example:

> Open this link, sign in to Polar with <email>, and enter this code: **amber-river-lemon**

Only the human signed in with that email can claim you. The link and code expire after 7 days.
Starting a new claim replaces them with a new pair, valid for 7 more days, as long as your claim
token is valid (30 days after sign-up).

Then poll every `interval` seconds:

```http
POST ${token_endpoint}
Content-Type: application/x-www-form-urlencoded

grant_type=urn:workos:agent-auth:grant-type:claim&claim_token=<claim_token>
```

- `authorization_pending`: the human hasn't entered the code yet. Keep polling.
- `slow_down`: you're polling too fast. Add 5 seconds to your interval.
- `expired_token`: the link and code expired, or your claim token did. Start a new claim; if that
  answers `claim_expired`, sign up again.
- Success: an `access_token` for the human, plus a new `identity_assertion` and
  `assertion_expires`. The claim token stops working.

Once claimed, you act on behalf of the human: the organization is theirs, and you have their
access. Everything issued to you before the claim stops working, including the old identity
assertion. Use the new one in Step 3 from now on.

${payments}

## Step 5: Get a token for the app

Your access token is for setting things up, not for running the app: it expires every hour and,
once you're claimed, acts for the human in all their organizations, so it can't ingest events.

When the app needs credentials (to ingest events, check a customer's meters or benefits, ...),
get an organization access token with the [Polar CLI](https://polar.sh/docs/integrate/cli/introduction).
Pass only the scopes the app needs:

```sh
POLAR_ACCESS_TOKEN=<access_token> polar auth token --scope events:write --scope ...
```

Give the human the link it prints; they must open it on the machine you run on. Once they
approve, the CLI prints the token. Store it in the app's secrets (e.g. `.env`), never in the
repo or the chat.

If you can't run the CLI on the human's machine, send them this link instead, with only the
scopes the app needs:

```
${dashboard_url}/<organization slug>/cli/token?name=<token name>&scopes=<scope>,<scope>
```

They create the token and put it in the app's secrets themselves. Don't ask them to paste it
into the chat.

## Errors

| Code | Where | What to do |
| --- | --- | --- |
| HTTP 422 | `${identity_endpoint}`, `${claim_endpoint}` | The body is invalid. Fix it; `detail` says how. |
| HTTP 429 | any | Too many requests. Back off and retry later. |
| `invalid_claim_token` (401) | `${claim_endpoint}` | The claim token is wrong, or you were revoked. Sign up again. |
| `claimed_or_in_flight` (409) | `${claim_endpoint}` | You're already claimed. Poll the token endpoint with your claim token. |
| `claim_expired` (410) | `${claim_endpoint}` | Your claim token expired. Sign up again. |
| `invalid_grant` | token endpoint, JWT bearer | See Step 3. |
| `invalid_grant` | token endpoint, claim poll | The claim token is wrong, already used, or you were revoked. |
| `invalid_client` | token endpoint | Don't send a `client_id`: Polar knows your client from your credentials. |
| `authorization_pending`, `slow_down`, `expired_token` | token endpoint, claim poll | See Step 4. |
| HTTP 403 | `/v1/events/ingest` | You're claimed, so your token can't ingest events. See Step 5. |

## Revoking

To revoke an access token, `POST ${revocation_endpoint}` with
`token=<access_token>&token_type_hint=access_token`. Your identity assertion keeps working.

API reference: ${api_documentation}
