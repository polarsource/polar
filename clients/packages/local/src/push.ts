/**
 * Push compiled meter definitions to Polar — the apply step of "billing config
 * as code". Idempotent: it lists existing meters, then for each compiled meter
 * creates it if missing, leaves it untouched if identical, or reports *drift*
 * if a meter of the same name exists with a different definition.
 *
 * Meters are immutable by default here. Retroactively changing a live meter's
 * filter/aggregation rewrites billing history, so drift is reported, not
 * silently applied — set `allowUpdate` to opt into PATCHing existing meters.
 * The safe versioned workflow is a new meter name per definition change.
 *
 * All Polar I/O goes through `@polar-sh/client` (see polar-client.ts).
 */
import type { schemas } from "@polar-sh/client";
import { Data, Effect } from "effect";
import { compileMeters, type CompileOptions } from "./compile";
import type { Plan } from "./dsl";
import type { Meter, MeterCreate } from "./polar";
import type { PolarClient } from "./polar-client";
import { canonicalJson } from "./serialize";

export class PolarApiError extends Data.TaggedError("PolarApiError")<{
  readonly status: number | "network";
  readonly message: string;
}> {}

const messageOf = (error: unknown, status: number): string => {
  const m = (error as { message?: unknown } | undefined)?.message;
  return typeof m === "string" ? m : `HTTP ${status}`;
};

/** Run a `@polar-sh/client` call, returning its data or a typed PolarApiError. */
const runCall = <T>(
  thunk: () => Promise<{ data?: T; error?: unknown; response: Response }>,
): Effect.Effect<T | undefined, PolarApiError> =>
  Effect.tryPromise({
    try: thunk,
    catch: (cause) => new PolarApiError({ status: "network", message: String(cause) }),
  }).pipe(
    Effect.flatMap(({ data, error, response }) =>
      response.ok && !error
        ? Effect.succeed(data)
        : Effect.fail(new PolarApiError({ status: response.status, message: messageOf(error, response.status) })),
    ),
  );

/** Every existing meter, following pagination. Keyed lookups are the caller's job. */
export const listMeters = (
  client: PolarClient,
  organizationId?: string,
): Effect.Effect<Meter[], PolarApiError> =>
  Effect.gen(function* () {
    const all: Meter[] = [];
    let page = 1;
    let maxPage = 1;
    do {
      const data = yield* runCall(() =>
        client.GET("/v1/meters/", {
          params: { query: { page, limit: 100, ...(organizationId ? { organization_id: organizationId } : {}) } },
        }),
      );
      for (const m of data?.items ?? []) all.push(m as Meter);
      maxPage = data?.pagination?.max_page ?? page;
      page += 1;
    } while (page <= maxPage);
    return all;
  });

export interface SyncOptions extends CompileOptions {
  /** Opt in to PATCHing meters whose definition drifted. Off by default (immutable meters). */
  readonly allowUpdate?: boolean;
}

export interface SyncReport {
  readonly created: ReadonlyArray<string>;
  readonly updated: ReadonlyArray<string>;
  readonly unchanged: ReadonlyArray<string>;
  /** Existing meters whose definition differs from the Plan (left untouched unless allowUpdate). */
  readonly drifted: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

/** The comparable essence of a meter — name plays no part, it's the key. */
const definitionOf = (m: MeterCreate | Meter): string =>
  canonicalJson({ filter: m.filter, aggregation: m.aggregation });

export const syncMeters = (
  client: PolarClient,
  plan: Plan,
  options: SyncOptions = {},
): Effect.Effect<SyncReport, PolarApiError> =>
  Effect.gen(function* () {
    // List every existing meter (paginated), keyed by name.
    const existing = new Map<string, Meter>();
    for (const m of yield* listMeters(client, options.organizationId)) existing.set(m.name, m);

    const { meters, warnings } = compileMeters(plan, options);
    const created: string[] = [];
    const updated: string[] = [];
    const unchanged: string[] = [];
    const drifted: string[] = [];

    for (const meter of meters) {
      const current = existing.get(meter.name);
      if (!current) {
        // Cast: our MeterCreate mirrors the schema but differs in readonly/array variance.
        yield* runCall(() => client.POST("/v1/meters/", { body: meter as unknown as schemas["MeterCreate"] }));
        created.push(meter.name);
      } else if (definitionOf(meter) === definitionOf(current)) {
        unchanged.push(meter.name);
      } else if (options.allowUpdate) {
        const body = { name: meter.name, filter: meter.filter, aggregation: meter.aggregation };
        yield* runCall(() =>
          client.PATCH("/v1/meters/{id}", {
            params: { path: { id: current.id } },
            body: body as unknown as schemas["MeterUpdate"],
          }),
        );
        updated.push(meter.name);
      } else {
        drifted.push(meter.name);
      }
    }

    return { created, updated, unchanged, drifted, warnings };
  });
