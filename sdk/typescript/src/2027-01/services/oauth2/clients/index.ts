import type { ClientBase } from "../../../../base";

import { createOauth2Service } from "./oauth2";

export function createClientsService(client: ClientBase) {
  return {
    oauth2: createOauth2Service(client),
  };
}

export type Clients = ReturnType<typeof createClientsService>;
