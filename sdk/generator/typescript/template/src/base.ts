export class PolarError extends Error {}

export class PolarNetworkError extends PolarError {
  constructor(message: string) {
    super(`Polar API network error: ${message}`);
    this.name = "PolarNetworkError";
  }
}

export class PolarServerError extends PolarError {
  constructor(statusCode: number, message: string) {
    super(`Polar API returned a server error: ${statusCode} - ${message}`);
    this.name = "PolarServerError";
  }
}

export class PolarClientError<T = unknown> extends PolarError {
  constructor(
    public readonly statusCode: number,
    public readonly error: T,
  ) {
    super(
      `Polar API returned an error: ${statusCode} - ${JSON.stringify(error)}`,
    );
    this.name = "PolarClientError";
  }
}

export class PolarRateLimitError extends PolarClientError {
  constructor(
    public readonly statusCode: 429,
    public readonly retryAfter: number | null = null,
  ) {
    super(statusCode, "Rate limit exceeded");
    this.name = "PolarRateLimitError";
  }
}

type PathParams = Record<string, string | number | boolean>;
type QueryParamValue =
  | string
  | string[]
  | number
  | number[]
  | boolean
  | boolean[]
  | null
  | undefined;
interface QueryParams {
  [key: string]: QueryParamValue | QueryParams;
}

const buildUrl = (
  url: string,
  pathParams?: PathParams,
  queryParams?: QueryParams,
): string => {
  // Format URL with path params using string replacement
  let formattedUrl = url;
  if (pathParams) {
    for (const [key, value] of Object.entries(pathParams)) {
      if (value !== null && value !== undefined) {
        formattedUrl = formattedUrl.replace(
          `{${key}}`,
          encodeURIComponent(String(value)),
        );
      }
    }
  }

  if (queryParams) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          for (const item of value) {
            searchParams.append(key, String(item));
          }
        } else if (typeof value === "object") {
          // Handle deepObject style parameters (e.g., metadata)
          for (const [subKey, subValue] of Object.entries(value)) {
            if (subValue !== null && subValue !== undefined) {
              if (Array.isArray(subValue)) {
                for (const item of subValue) {
                  searchParams.append(`${key}[${subKey}]`, String(item));
                }
              } else {
                searchParams.append(`${key}[${subKey}]`, String(subValue));
              }
            }
          }
        } else {
          searchParams.append(key, String(value));
        }
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      formattedUrl = `${formattedUrl}?${queryString}`;
    }
  }

  return formattedUrl;
};

export interface ClientOptions {
  baseUrl: string;
  version: string;
  accessToken: string;
  /** Default request timeout, in seconds. */
  timeout?: number;
}

export interface RequestOptions {
  /** Request timeout override, in seconds. */
  timeout?: number;
  /** Access token override for this request. */
  accessToken?: string;
}

const MAX_ABORT_SIGNAL_TIMEOUT_MS = 2_147_483_647;

export const resolveBaseUrl = (
  servers: Record<string, string>,
  environment: string,
  baseUrl?: string,
): string => {
  if (baseUrl !== undefined) {
    return baseUrl;
  }
  const serverUrl = servers[environment];
  if (serverUrl === undefined) {
    throw new Error(
      `Invalid environment ${JSON.stringify(environment)}. Expected one of: ${Object.keys(servers).sort().join(", ")}.`,
    );
  }
  return serverUrl;
};

export class ClientBase {
  protected readonly options: ClientOptions;

  constructor(options: ClientOptions) {
    this.options = {
      timeout: 5.0,
      ...options,
    }
  }

  public buildRequest(
    method: string,
    url: string,
    pathParams?: PathParams,
    queryParams?: QueryParams,
    body?: unknown,
  ): [string, RequestInit] {
    const fullUrl = buildUrl(
      `${this.options.baseUrl}${url}`,
      pathParams,
      queryParams,
    );
    const headers = new Headers({
      "Content-Type": "application/json",
      "Polar-Version": this.options.version,
      Authorization: `Bearer ${this.options.accessToken}`,
    });
    return [
      fullUrl,
      {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    ];
  }

  public async sendRequest(
    request: [string, RequestInit],
    requestOptions?: RequestOptions,
  ): Promise<Response> {
    const [fullUrl, requestInit] = request;
    const timeout = requestOptions?.timeout ?? this.options.timeout;
    let headers = requestInit.headers;
    if (requestOptions?.accessToken !== undefined) {
      headers = new Headers(headers);
      headers.set("Authorization", `Bearer ${requestOptions.accessToken}`);
    }
    let signal = requestInit.signal;
    if (timeout !== undefined) {
      const timeoutMilliseconds = Math.ceil(timeout * 1000);
      if (
        !Number.isFinite(timeout) ||
        timeout < 0 ||
        timeoutMilliseconds > MAX_ABORT_SIGNAL_TIMEOUT_MS
      ) {
        throw new RangeError(
          `Timeout must be a finite, non-negative number no greater than ${MAX_ABORT_SIGNAL_TIMEOUT_MS / 1000} seconds`,
        );
      }
      const timeoutSignal = AbortSignal.timeout(timeoutMilliseconds);
      signal = signal
        ? AbortSignal.any([signal, timeoutSignal])
        : timeoutSignal;
    }
    try {
      return await fetch(fullUrl, {
        ...requestInit,
        headers,
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new PolarNetworkError(errorMessage);
    }
  }

  public async parseResponse<T>(
    response: Response,
    responseType: "json" | "text" | "none",
    errors?: Record<number, new (...args: any[]) => PolarClientError>,
  ): Promise<T> {
    const statusCode = response.status;

    if (statusCode >= 500 && statusCode < 600) {
      const text = await response.text().catch(() => "");
      throw new PolarServerError(statusCode, text || "Server error");
    }

    if (statusCode >= 400 && statusCode < 500) {
      if (statusCode === 429) {
        const retryAfter = response.headers.get("Retry-After");
        throw new PolarRateLimitError(
          statusCode,
          retryAfter ? parseInt(retryAfter, 10) : null,
        );
      }
      if (errors?.[statusCode]) {
        const ErrorClass = errors[statusCode];
        const errorData = await response.json();
        throw new ErrorClass(statusCode, errorData);
      } else {
        const text = await response.text().catch(() => "");
        throw new PolarClientError(statusCode, text || "Client error");
      }
    }

    if (responseType === "json") {
      return (await response.json()) as T;
    }
    if (responseType === "text") {
      return (await response.text()) as unknown as T;
    }

    return undefined as unknown as T;
  }
}
