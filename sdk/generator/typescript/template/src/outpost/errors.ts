import { PolarError } from "../base";

export class PolarOutpostError extends PolarError {}
/** A read Outpost cannot answer yet: Polar has not sent the configuration or the snapshot in time. */
export class NotReadyError extends PolarOutpostError {}
export class UnavailableRedisError extends PolarOutpostError {
  constructor(options?: ErrorOptions) {
    super("Redis is unavailable", options);
  }
}
export const redisUnavailable = (error: unknown): UnavailableRedisError =>
  new UnavailableRedisError({ cause: error });
export const isRedisConnectionError = (error: unknown): boolean => {
  if (error instanceof UnavailableRedisError) return isRedisConnectionError(error.cause);
  return (
    error instanceof Error &&
    (error.name === "MaxRetriesPerRequestError" ||
      [
        "ECONNABORTED",
        "ECONNREFUSED",
        "ECONNRESET",
        "EHOSTUNREACH",
        "ENETUNREACH",
        "ENOTFOUND",
        "EPIPE",
        "ETIMEDOUT",
        "EAI_AGAIN",
      ].includes((error as NodeJS.ErrnoException).code ?? "") ||
      [
        "Command timed out",
        "Connection is closed.",
        "Stream isn't writeable and enableOfflineQueue options is false",
      ].includes(error.message))
  );
};

/** Polar answered 401 or 403: nothing Outpost asks will pass until the token does. */
export class RefusedError extends PolarOutpostError {
  constructor(message = "Polar refused Outpost") {
    super(message);
  }
}
