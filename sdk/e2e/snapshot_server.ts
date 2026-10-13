import { createInterface } from "node:readline";
import { WebSocketServer, WebSocket } from "ws";
import type { EventInput, Reducer } from "@polar-sh/sdk/outpost";

type Customer = Pick<EventInput, "customer_id" | "external_customer_id">;
type Configuration = { reducers: Reducer[] };
type Snapshot = Customer & {
  cold_until: number;
  cold: Record<string, number>;
  credited: Record<string, number>;
};
type Command =
  | { operation: "configure"; arguments: { configuration: Configuration; snapshots: Snapshot[] } }
  | { operation: "snapshot"; arguments: Snapshot }
  | { operation: "close" };
type Message = { type: "configuration" } | { type: "snapshot"; payload: Customer };

const server = new WebSocketServer({ host: "127.0.0.1", port: 0, path: "/v1/outpost/" });
let configuration: Configuration;
const snapshots = new Map<string, Snapshot>();
const customerKey = (payload: Customer) =>
  payload.customer_id !== undefined
    ? `customer:${payload.customer_id}`
    : `external:${payload.external_customer_id}`;
const send = (socket: WebSocket, type: string, payload: Configuration | Snapshot) => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, payload }));
};

server.on("connection", (socket, request) => {
  if (request.headers.authorization !== "Bearer harness-token") {
    socket.close(1008, "Invalid token");
    return;
  }
  socket.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString()) as Message;
      if (message.type === "configuration") {
        send(socket, "configuration", configuration);
        for (const snapshot of snapshots.values()) send(socket, "snapshot", snapshot);
      } else if (message.type === "snapshot") {
        const snapshot = snapshots.get(customerKey(message.payload));
        if (snapshot) send(socket, "snapshot", snapshot);
      } else socket.close(1008, "Unknown message");
    } catch {
      socket.close(1008, "Invalid message");
    }
  });
});

await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
if (address === null || typeof address === "string") throw new Error("Missing server address");
console.log(JSON.stringify({ result: `http://127.0.0.1:${address.port}` }));
for await (const line of createInterface({ input: process.stdin })) {
  try {
    const command = JSON.parse(line) as Command;
    if (command.operation === "close") {
      console.log(JSON.stringify({ result: null }));
      break;
    }
    if (command.operation === "configure") {
      const args = command.arguments;
      configuration = args.configuration;
      for (const snapshot of args.snapshots) snapshots.set(customerKey(snapshot), snapshot);
    } else if (command.operation === "snapshot") {
      const args = command.arguments;
      snapshots.set(customerKey(args), args);
      for (const socket of server.clients) send(socket, "snapshot", args);
    } else throw new Error("Unknown server operation");
    console.log(JSON.stringify({ result: null }));
  } catch (error) {
    console.log(JSON.stringify({ error: String(error) }));
  }
}
for (const socket of server.clients) socket.terminate();
await new Promise<void>((resolve) => server.close(() => resolve()));
