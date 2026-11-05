// The runtime module Durable Objects extend; its types live in the workers-types module.
declare module "cloudflare:workers" {
  import { CloudflareWorkersModule } from "@cloudflare/workers-types";
  export import DurableObject = CloudflareWorkersModule.DurableObject;
}
