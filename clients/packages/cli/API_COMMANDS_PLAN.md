# Generated Polar API Commands

## Goal

Add build-time-generated API subcommands to the Polar CLI, following Stripe CLI's interface and generator architecture while retaining Polar's Effect-based runtime, authentication, and environment handling.

The initial release must cover the non-composite capabilities already supported by Polar MCP. Composite workflows are out of scope: no workflow commands, orchestration, recipes, or workflow acceptance tests.

This document consolidates the implementation discussion and incorporates the decisions to exclude composite workflows and copy Stripe's actual interface rather than invent a new one. Repository observations reflect the research performed during that discussion; recheck them against the implementation branch before changing code.

## Research sources

- [Polar Functionality Map](https://docs.google.com/spreadsheets/d/1my_jgG_8HtvEr65eGLGZxpk1uiS_R3q1P4ITSVc__lc/edit?gid=1055412611#gid=1055412611), inspected through Playwriter.
- `docs/integrate/mcp.mdx`, relative to the Polar repository root.
- `sdk/generator/`, including its versioned OpenAPI snapshots, intermediate representation, and TypeScript emitter.
- `clients/packages/cli/`, including command registration, authentication, organization selection, API execution, and release configuration.
- `~/projects/stripe-cli/pkg/gen/gen_resources_cmds.go` and `resources_cmds.go.tpl`.
- `~/projects/stripe-cli/pkg/cmd/resource/{resource,operation,nested_flags,spec_data}.go`.
- `~/projects/stripe-cli/pkg/requests/base.go`.

The sheet contained 54 MCP-supported capabilities, of which four were composite workflows. The initial target is therefore **50 non-composite capabilities**. The MCP documentation listed **100 underlying operations**; capabilities and operations are not one-to-one.

## 1. Define an executable parity contract

Create a checked-in manifest mapping:

```text
Capability identifier → MCP operation → OpenAPI operationId → CLI command → test
```

Use stable capability identifiers, not spreadsheet row numbers. The manifest defines operation selection and explicit exceptions; it must not duplicate request schemas. OpenAPI remains authoritative for parameters and payloads.

### Included areas

- Products, benefits, benefit grants, and files.
- Checkout links and checkout-session inspection.
- Discounts, custom fields, and meters.
- Customers, external-ID operations, members, and seats.
- Orders, invoices, receipts, refunds, and subscriptions.
- License keys and activation inspection.
- Payments and organization inspection.
- Metrics, events, event types, and customer meters.
- Webhook endpoints, deliveries, and redelivery.

Do not automatically expose every public endpoint. The sheet deliberately excludes some public operations, including organization updates because their input schema also exposes SSO enforcement. Rows marked “add” in the MCP Action column are future work, not current parity requirements.

### Resolve discrepancies before claiming parity

- MCP documents organization-wide “List customer members,” but `members:list_members` was private in the checked-in specs. Public customer-scoped member-list operations exist, but are not an exact replacement.
- The sheet includes meter quantity charts, while the documented MCP operation catalog omits the public `meters:quantities` operation.

Confirm the deployed MCP catalog or configuration and agree on these mappings. Do not silently expose private endpoints, substitute weaker capabilities, or omit required capabilities. The deployed catalog was not independently verified during the research.

## 2. Copy Stripe's command interface

### Command hierarchy and naming

Stripe's structure is:

```text
stripe [namespace] <plural_resource> <operation> [path_arguments] [flags]
```

Apply that structure directly under `polar`, alongside existing commands such as `auth`, `listen`, and `update`:

```bash
polar products list
polar products get <id>
polar products update <id>
polar products update_benefits <id>
polar checkout_links list
polar customers get_external <external_id>
polar customers members get <customer_id> <member_id>
polar subscriptions revoke <id>
```

Rules:

- Derive hierarchy from Polar's colon-separated `operationId`.
- Normalize resource names to snake_case and retain already-plural names.
- Preserve operation names such as `get_external` and `update_benefits`.
- Keep Polar's `get`; Stripe's `retrieve` comes from its own API metadata, not a universal HTTP-method mapping.
- Generate positional arguments for URL placeholders, ordered by their appearance in the URL.
- Avoid bespoke regrouping, such as inventing a webhook hierarchy unrelated to operation metadata.
- Fail generation on command, alias, flag, or built-in-name collisions.

### Generated parameter flags

Copy Stripe's hyphenated parameter names and explicit-value behavior:

```bash
polar customers create --email=alice@example.com --name="Alice"
polar products update <id> --is-archived
polar products update <id> --is-archived=false
polar subscriptions list --product-id=<first_id> --product-id=<second_id>
```

- Convert field underscores to flag hyphens while preserving original wire names.
- Support `--flag`, `--flag=true`, and `--flag=false` for booleans.
- Repeat scalar-array flags once per element.
- Only transmit explicitly supplied values; parser defaults must not become API inputs.
- Preserve omitted values, `false`, `0`, empty strings, and `null` as distinct inputs.
- Do not populate PATCH bodies with schema defaults.

### Nested fields

Generate dotted flags for nested objects and normalize bracket notation to the same flags:

```bash
polar customers update <id> --billing-address.country=US
polar customers update <id> '--billing_address[country]=US'
```

Avoid indexed generated flags for arrays of objects. Use JSON input for complex prices, benefit properties, and similar payloads. Do not choose an arbitrary union variant when generating flags; complete discriminated-union inputs must remain expressible through JSON.

### JSON input: `--data`, not `--body`

Stripe supports repeated `-d 'key=value'` for its V1 form APIs and a single `-d '<JSON object>'` for its V2 JSON APIs. Copy the **JSON mode** for Polar, regardless of Polar's `/v1` URL prefix:

```bash
polar products update_benefits <id> -d '{"benefits":["<benefit_id>"]}'
polar customers update <id> --name="Alice" -d '{"metadata":{"source":"cli"}}'
```

- `-d` aliases `--data` and accepts one JSON object.
- Generated flags may be combined with JSON input.
- Explicit generated flags override matching top-level JSON keys.
- Match Stripe's shallow merge, not a recursive merge; document and test nested-object replacement.
- Preserve JSON types, including explicit `null`.
- Route inputs to path, query, or body according to Polar's OpenAPI definitions rather than assuming every non-GET parameter belongs in the body.
- Validate assembled inputs after organization defaults and merging. Required values supplied through JSON must satisfy validation without also requiring their flags.

Do not add the previously proposed `--body`, `@file`, stdin syntax, or form-style `-d key=value` to the initial interface. They are not part of the inspected Stripe JSON parser's behavior.

### Shared controls

| Control                | Behavior                                                    |
| ---------------------- | ----------------------------------------------------------- |
| `--dry-run`            | Display the prepared request without sending it.            |
| `--confirm`, `-c`      | Skip DELETE confirmation.                                   |
| `--show-headers`, `-s` | Include response headers.                                   |
| `--help`               | Show generated arguments, request parameters, and examples. |
| `--page`, `--limit`    | Expose Polar's actual pagination parameters where declared. |

For DELETE operations, including subscription revocation, show environment and relevant organization context and require confirmation. Noninteractive execution requires `--confirm`. Do not invent organization context when it cannot be established.

Use explicit pagination, following Stripe's request interface. Do not implement `--all` initially or copy Stripe's cursor parameters into Polar's page-based API.

Keep Polar's existing `--production`, `--org`, and authentication behavior. Do not copy Stripe-only controls such as Connect account headers, `--expand`, or unsupported idempotency semantics. Keep the API version pinned rather than introducing an arbitrary version override initially.

Dry-run output follows Stripe's structure:

```json
{
  "dry_run": {
    "method": "PATCH",
    "url": "https://sandbox-api.polar.sh/v1/products/...",
    "params": { "is_archived": true },
    "headers": { "Polar-Version": "2026-04" }
  }
}
```

Never expose authentication tokens. Dry runs must not trigger login, token refresh, or API requests. Request preparation must be shared with real execution so the preview cannot diverge from what is sent.

### Help and output

Follow Stripe's help sections: Usage, Examples, Available Operations, Request Parameters, Flags, and Global Flags. Generate examples from required inputs and preserve API descriptions and enum information.

Return API JSON rather than introducing tables. Keep response data on stdout and diagnostics, headers, confirmation prompts, and update notices on stderr. Empty successes produce no body. Failures return nonzero exit codes. Preserve these Polar safety and scripting guarantees rather than copying incidental Stripe quirks.

Invoice and receipt operations initially return the API's download information. A convenience download option is not required for underlying MCP operation parity.

## 3. Reuse Polar's generator

Add a dedicated CLI generation entry point under `sdk/generator/`, reusing the existing OpenAPI parser and intermediate representation rather than creating another parser inside the CLI package.

```text
Versioned OpenAPI + parity manifest + explicit naming exceptions
                              ↓
                      Existing Polar API IR
                              ↓
                          CLI emitter
                              ↓
         Command definitions + input schemas + SDK adapters
                              ↓
                   Shared Effect command runtime
                              ↓
                           Polar API
```

Generate a private `@polar-sh/cli-commands` package under `sdk/cli-commands/`, with source partitioned by resource. The CLI imports its command tree from this package; generated code does not import the CLI. The CLI provides implementations of the package's Effect service contracts.

For the initial prototype, use a local `file:../../../sdk/cli-commands` dependency. pnpm accepts workspace members outside `clients/`, but this repository's Turbo setup rejects them. A local file dependency preserves the package boundary without moving the workspace root or publishing anything. Refresh the installed package after generation.

The generated package contains:

- Command registration, positional arguments, and typed flags.
- Nested flag normalization metadata and help information.
- Input validation schemas.
- Statically typed SDK invocation adapters.
- Operation metadata and a coverage report.

Reuse SDK naming helpers. Prefer generated typed calls such as `client.products.update(id, body)` over runtime string-based SDK dispatch with `any`.

The existing IR already handles services, references, unions, nullability, and pagination. Supplement missing CLI metadata, particularly authentication requirements and allowed subjects.

### API version and transport checkpoint

The researched CLI used `@polar-sh/sdk/2026-04`; start with that explicitly pinned API version unless the implementation branch has deliberately changed it. Type-check adapters against the installed SDK and update the snapshot, SDK dependency, and generated commands together.

The existing SDK wrapper alone does not provide all the preparation and response-header access needed for this interface. Prove a shared prepare/preview/send integration in the first vertical slice, reusing SDK request construction where possible. Resolve this before generating the full command set; do not build a separate dry-run serializer that merely approximates execution.

## 4. Implement the shared Effect runtime

Keep generated code declarative. Handwritten services own input assembly, authentication, request preparation, confirmation, execution, output, and errors.

### Authentication and organization selection

- Reuse existing authentication and credential services; do not create another credential store.
- Keep sandbox as the default and production explicitly selected.
- Preserve token-override precedence and environment-isolated saved sessions.
- Preserve a bounded one-time refresh/retry after an explicit 401 for saved sessions.
- Do not blindly retry mutations after connection failures or timeouts.
- Audit operation scopes against OAuth scopes and handle insufficient grants clearly.
- Support anonymous seat-claim operations without requiring merchant login.
- Apply a saved organization only where an operation declares an organization input.
- Explicit organization input overrides a saved default; conflicting explicit inputs are errors.
- Do not require `organizations:read` merely to execute an otherwise valid API operation.
- Do not imply that `--org` constrains an ID-only endpoint lacking an organization filter.

### API errors

At research time, `src/services/polar.ts` discarded API details and mapped general failures to organization/authentication messages. Recheck its current state and introduce or reuse a general API error representation preserving HTTP status, API code/message, validation details, retry information where available, and the original cause without credential leakage.

Distinguish authentication, authorization, validation, missing-resource, rate-limit, and network failures. Extend error presentation without regressing existing auth, listen, or update commands.

## 5. Build and CI integration

Add `generate` and `generate:check` package commands. Run generation before JavaScript builds and every binary compilation path.

The researched `.github/workflows/release_cli.yml` invoked `bun build` directly, so package-script hooks alone would miss releases. Update release compilation explicitly.

- Commit generated files for review and source execution.
- Regenerate during builds and fail CI on generated-file drift.
- Remove stale generated files deterministically.
- Record source API version and input hashes.
- Never fetch the spreadsheet or a live API spec during builds.
- Include generator, snapshot, and manifest changes in CI path filters and Turbo cache inputs.
- Install `uv` and locked generator dependencies in relevant build environments.
- Do not require a running backend, database, backend secrets, or backend environment configuration merely to generate CLI commands from committed snapshots.

## 6. Verification and release gates

### Generator tests

Test naming, collisions, private-operation exclusion, missing manifest operations, references, unions, enums, nullability, arrays, required fields, omitted defaults, deterministic output, and stale-file removal.

### CLI contract tests

Use the existing Vitest/Bun setup, Effect test layers, and a local HTTP server. Assert actual requests and observable command behavior:

- URL, method, encoded path parameters, query parameters, body, and API-version header.
- Boolean syntax, repeatable arrays, dotted/bracket aliases, and explicit-value preservation.
- JSON input, shallow merge precedence, required inputs through JSON, and invalid-input failures.
- Environment selection, token overrides, bounded refresh, anonymous operations, and organization precedence.
- DELETE confirmation and noninteractive `--confirm` behavior.
- Dry-run equivalence to actual request preparation, no API calls, and token secrecy.
- Response headers, JSON-only stdout, empty successes, API error details, and nonzero failure exits.
- Explicit pagination parameters without automatic page traversal.
- Offline help and command completion without requiring credentials.

Every one of the 50 agreed non-composite capabilities must have an implementation mapping and test evidence. Verify representative individual operations in sandbox; feature-flagged capabilities need contract coverage and live verification where enabled. Do not add composite workflow tests.

Run CLI formatting, lint, type-checking, tests, and binary build checks. For generator changes, follow its `AGENTS.md` and established `just` commands.

## 7. Suggested delivery sequence

| PR  | Deliverable                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Parity manifest, discrepancy resolution, interface contract, and proposed ADR for generation/versioning policy.              |
| 2   | Shared preparation/execution/errors, Stripe-style controls, and a products/customers vertical slice proving SDK integration. |
| 3   | CLI emitter, generated inputs/help, typed adapters, and build integration.                                                   |
| 4   | Remaining MCP operations and complete non-composite capability mappings.                                                     |
| 5   | Individual-operation sandbox verification, generated reference documentation, CI parity gates, and release changeset.        |

## Definition of done

Every agreed non-composite MCP capability is executable through documented Stripe-style subcommands, generated reproducibly from a pinned OpenAPI snapshot. There are no unexplained coverage gaps, accidental private API exposures, composite workflow requirements, or mismatches between dry-run and actual request preparation.
