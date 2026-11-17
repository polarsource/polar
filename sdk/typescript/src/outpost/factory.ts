import type { ClientBase } from "../base";

import { MeteringError } from "../metering/errors";
import { Outpost, type OutpostOptions } from "./client";

export type OutpostFactoryOptions = Omit<OutpostOptions, "client"> & {
  /** Redis connection URL. Defaults to the REDIS_URL environment variable. */
  redisUrl?: string;
};

/**
 * Configure Outpost for polar.metering({ outpost: outpost({ redisUrl }) }).
 *
 * @throws MeteringError if neither redisUrl nor REDIS_URL is set.
 */
export const outpost = ({
  redisUrl = process.env.REDIS_URL,
  ...options
}: OutpostFactoryOptions = {}): ((client: ClientBase) => Outpost) => {
  if (!redisUrl) throw new MeteringError("Outpost requires redisUrl or REDIS_URL");
  return (client) => new Outpost(redisUrl, { ...options, client });
};
