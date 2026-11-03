import {
  HealthResponse,
  MeResponse,
  type AcceptConsentRequest,
  type UpdateMeRequestInput,
} from '@noor/contracts';

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
  /** The signed-in user. The caller passes the ID token, so this module stays Firebase-free. */
  getMe(init: { idToken: string; signal?: AbortSignal }): Promise<MeResponse>;
  /** Changes the signed-in user's own profile and returns it. */
  updateMe(init: {
    idToken: string;
    body: UpdateMeRequestInput;
    signal?: AbortSignal;
  }): Promise<MeResponse>;
  /** Records the signed-in user's acceptance of the given consent version and returns `me`. */
  acceptConsent(init: {
    idToken: string;
    body: AcceptConsentRequest;
    signal?: AbortSignal;
  }): Promise<MeResponse>;
  /** Deletes the signed-in account. Resolves on 204 and never reads a body. */
  deleteMe(init: { idToken: string; signal?: AbortSignal }): Promise<void>;
}

interface Schema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

interface CallInit {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  body?: unknown;
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const baseUrl = options.baseUrl ?? '';
  // Resolve fetch lazily so a test or browser can swap globalThis.fetch after import.
  const doFetch: typeof globalThis.fetch =
    options.fetch ?? ((...args) => globalThis.fetch(...args));

  async function send(
    method: 'GET' | 'PATCH' | 'POST' | 'DELETE',
    path: string,
    init: CallInit = {},
  ) {
    const hasBody = init.body !== undefined;
    let res: Response;
    try {
      res = await doFetch(`${baseUrl}${path}`, {
        method,
        headers: {
          ...init.headers,
          accept: 'application/json',
          ...(hasBody ? { 'content-type': 'application/json' } : {}),
        },
        body: hasBody ? JSON.stringify(init.body) : undefined,
        signal: init.signal,
      });
    } catch (cause) {
      throw new ApiError(`Network error for ${method} ${path}`, { cause });
    }
    if (!res.ok) {
      throw new ApiError(`${method} ${path} failed with ${res.status}`, { status: res.status });
    }
    return res;
  }

  async function request<T>(
    method: 'GET' | 'PATCH' | 'POST',
    path: string,
    schema: Schema<T>,
    init: CallInit = {},
  ): Promise<T> {
    const res = await send(method, path, init);
    let body: unknown;
    try {
      body = await res.json();
    } catch (cause) {
      throw new ApiError(`${method} ${path} returned a non-JSON body`, {
        status: res.status,
        cause,
      });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(`${method} ${path} returned a body that breaks the contract`, {
        status: res.status,
      });
    }
    return parsed.data;
  }

  const bearer = (idToken: string) => ({ authorization: `Bearer ${idToken}` });

  return {
    getHealth: (init) => request('GET', '/v1/health', HealthResponse, { signal: init?.signal }),
    getMe: ({ idToken, signal }) =>
      request('GET', '/v1/me', MeResponse, { signal, headers: bearer(idToken) }),
    updateMe: ({ idToken, body, signal }) =>
      request('PATCH', '/v1/me', MeResponse, { signal, headers: bearer(idToken), body }),
    acceptConsent: ({ idToken, body, signal }) =>
      request('POST', '/v1/me/consent', MeResponse, { signal, headers: bearer(idToken), body }),
    deleteMe: async ({ idToken, signal }) => {
      await send('DELETE', '/v1/me', { signal, headers: bearer(idToken) });
    },
  };
}

export const apiClient = createApiClient();
