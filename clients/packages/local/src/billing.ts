/**
 * Your billing program, as code — the file an integrator edits.
 *
 * Each ruleset is a version with an `effectiveFrom` date. To change pricing,
 * add a NEW ruleset (don't mutate an old one) so history stays replayable: past
 * periods keep billing under the rules that were in effect, and you can run
 * what-ifs against any version. Commit this file; your VCS is the audit trail.
 */
import { perUnit, product } from "./dsl";
import { count, maxOf, sumOf } from "./meter";
import { cents, micros } from "./money";
import { rulesetHistory } from "./ruleset";

export const history = rulesetHistory([
  {
    version: "2026.1.0",
    effectiveFrom: Date.UTC(2026, 0, 1),
    plan: product("api-access")
      .meter("tokens", sumOf("amount"), perUnit(micros(2n))) // $0.000002 / token
      .meter("requests", count(), perUnit(micros(50n)))
      .meter("seats", maxOf("amount"), perUnit(cents(500))) // $5.00 / peak seat
      .build(),
  },
  // Example of a future price change — uncomment to bill periods from Apr 1 anew:
  // {
  //   version: "2026.2.0",
  //   effectiveFrom: Date.UTC(2026, 3, 1),
  //   plan: product("api-access")
  //     .meter("tokens", sumOf("amount"), perUnit(micros(3n)))
  //     .meter("requests", count(), perUnit(micros(50n)))
  //     .meter("seats", maxOf("amount"), perUnit(cents(600)))
  //     .build(),
  // },
]);
