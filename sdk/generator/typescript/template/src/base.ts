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
              searchParams.append(`${key}[${subKey}]`, String(subValue));
            }
          }
        } else {
          searchParams.append(key, String(value));
        }
      }
    }
    const queryString = searchParams.toString();
    formattedUrl = `${formattedUrl}?${queryString}`;
  }

  return formattedUrl;
};

export interface ClientOptions {
  baseUrl: string;
  version: string;
  accessToken: string;
}

export class ClientBase {
  protected readonly options: ClientOptions;

  constructor(options: ClientOptions) {
    this.options = options;
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

  public async sendRequest(request: [string, RequestInit]): Promise<Response> {
    const [fullUrl, requestInit] = request;
    try {
      return await fetch(fullUrl, requestInit);
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

    if (response.status >= 500 && response.status < 600) {
      const text = await response.text().catch(() => "");
      throw new PolarServerError(statusCode, text || "Server error");
    }

    if (response.status >= 400 && response.status < 500) {
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
