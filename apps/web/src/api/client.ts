import { HealthResponse } from '@noor/contracts';

/** Any failure talking to the API: network, non-2xx status, non-JSON body or contract mismatch. */
export class ApiError extends Error {
  override name = 'ApiError';
  readonly status?: number;

  constructor(message: string, options?: { status?: number; cause?: unknown }) {
    super(message, { cause: options?.cause });
    if (options?.status !== undefined) this.status = options.status;
  }
}

export interface ApiClientOptions {
  /** Origin prefix for API calls. Empty means same origin (Vite proxies `/v1`). */
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export interface ApiClient {
  getHealth(init?: { signal?: AbortSignal }): Promise<HealthResponse>;
}

interface Schema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const baseUrl = options.baseUrl ?? '';
  // Resolve fetch lazily so a test or browser can swap globalThis.fetch after import.
  const doFetch: typeof globalThis.fetch =
    options.fetch ?? ((...args) => globalThis.fetch(...args));

  async function getJson<T>(path: string, schema: Schema<T>, signal?: AbortSignal): Promise<T> {
    let res: Response;
    try {
      res = await doFetch(`${baseUrl}${path}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal,
      });
    } catch (cause) {
      throw new ApiError(`Network error for GET ${path}`, { cause });
    }
    if (!res.ok) {
      throw new ApiError(`GET ${path} failed with ${res.status}`, { status: res.status });
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch (cause) {
      throw new ApiError(`GET ${path} returned a non-JSON body`, { status: res.status, cause });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(`GET ${path} returned a body that breaks the contract`, {
        status: res.status,
      });
    }
    return parsed.data;
  }

  return {
    getHealth: (init) => getJson('/v1/health', HealthResponse, init?.signal),
  };
}

export const apiClient = createApiClient();
