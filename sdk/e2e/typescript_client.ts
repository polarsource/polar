import { createInterface } from "node:readline";
import { Outpost, type EventInput } from "@polar-sh/sdk/outpost";
import { createPolarCore } from "@polar-sh/sdk/2026-10";

type Customer = Parameters<Outpost["actor"]>[0];
type Command =
  | { operation: "ingest"; arguments: { events: EventInput[] } }
  | { operation: "confirm"; arguments: { events: EventInput[] } }
  | { operation: "read"; arguments: Customer & { meter_id: string } }
  | { operation: "actor"; arguments: Customer }
  | { operation: "close" };

const [redisUrl, baseUrl] = process.argv.slice(2);
const outpost = new Outpost(redisUrl, {
  client: createPolarCore({ accessToken: "harness-token", baseUrl }),
  telemetry: false,
});
const respond = (response: { result: unknown } | { error: string }) =>
  console.log(JSON.stringify(response));

try {
  await outpost.start();
  respond({ result: null });
  for await (const line of createInterface({ input: process.stdin })) {
    try {
      const command = JSON.parse(line) as Command;
      if (command.operation === "close") {
        respond({ result: null });
        break;
      }
      switch (command.operation) {
        case "ingest":
          for (const event of command.arguments.events) await outpost.track(event);
          respond({ result: null });
          break;
        case "confirm":
          await outpost.confirm(command.arguments.events);
          respond({ result: null });
          break;
        case "read":
          respond({ result: await outpost.meter(command.arguments) });
          break;
        case "actor":
          await outpost.actor(command.arguments);
          respond({ result: null });
          break;
        default:
          throw new Error("Unknown client operation");
      }
    } catch (error) {
      respond({ error: String(error) });
    }
  }
} finally {
  await outpost.close();
}
