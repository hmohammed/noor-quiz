import {
  CommunityResponse,
  CreateInviteResponse,
  HealthResponse,
  InvitePreviewResponse,
  MeResponse,
  MembersResponse,
  MemberView,
  MyCommunitiesResponse,
  RamadanSuggestionResponse,
  SeasonListResponse,
  SeasonView,
  type AcceptConsentRequest,
  type ChangeMemberRoleRequestInput,
  type CreateCommunityRequestInput,
  type CreateInviteRequestInput,
  type CreateSeasonRequestInput,
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
  /** Creates a community owned by the signed-in user. */
  createCommunity(init: {
    idToken: string;
    body: CreateCommunityRequestInput;
    signal?: AbortSignal;
  }): Promise<CommunityResponse>;
  /** Communities the signed-in user belongs to. */
  listMyCommunities(init: {
    idToken: string;
    signal?: AbortSignal;
  }): Promise<MyCommunitiesResponse>;
  /** Creates an invite for a community the signed-in user administers. */
  createInvite(init: {
    idToken: string;
    tenantId: string;
    body: CreateInviteRequestInput;
    signal?: AbortSignal;
  }): Promise<CreateInviteResponse>;
  /** Public preview. No token: a signed-out visitor can load the community name. */
  previewInvite(init: { token: string; signal?: AbortSignal }): Promise<InvitePreviewResponse>;
  /** Joins the community behind an invite. The body is always empty. */
  acceptInvite(init: {
    idToken: string;
    token: string;
    signal?: AbortSignal;
  }): Promise<CommunityResponse>;
  /** Seasons of one community the caller belongs to. */
  listSeasons(init: {
    idToken: string;
    tenantId: string;
    signal?: AbortSignal;
  }): Promise<SeasonListResponse>;
  /** Creates a season. The server decides the id, the tenant and the state. */
  createSeason(init: {
    idToken: string;
    tenantId: string;
    body: CreateSeasonRequestInput;
    signal?: AbortSignal;
  }): Promise<SeasonView>;
  /** Advisory Hijri start. Does not create a season. */
  suggestRamadanStart(init: {
    idToken: string;
    tenantId: string;
    timezone: string;
    signal?: AbortSignal;
  }): Promise<RamadanSuggestionResponse>;
  /** Members of one community. Admin and owner only. */
  listMembers(init: {
    idToken: string;
    tenantId: string;
    signal?: AbortSignal;
  }): Promise<MembersResponse>;
  /** Proposes a new role. The server decides whether it is allowed. */
  changeMemberRole(init: {
    idToken: string;
    tenantId: string;
    userId: string;
    body: ChangeMemberRoleRequestInput;
    signal?: AbortSignal;
  }): Promise<MemberView>;
  /** Removes someone else. Resolves on 204 and never reads a body. */
  removeMember(init: {
    idToken: string;
    tenantId: string;
    userId: string;
    signal?: AbortSignal;
  }): Promise<void>;
  /** Leaves one community. The body is always empty. Resolves on 204. */
  leaveCommunity(init: { idToken: string; tenantId: string; signal?: AbortSignal }): Promise<void>;
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
    createCommunity: ({ idToken, body, signal }) =>
      request('POST', '/v1/communities', CommunityResponse, {
        signal,
        headers: bearer(idToken),
        body,
      }),
    listMyCommunities: ({ idToken, signal }) =>
      request('GET', '/v1/me/communities', MyCommunitiesResponse, {
        signal,
        headers: bearer(idToken),
      }),
    createInvite: ({ idToken, tenantId, body, signal }) =>
      request('POST', `/v1/t/${encodeURIComponent(tenantId)}/invites`, CreateInviteResponse, {
        signal,
        headers: bearer(idToken),
        body,
      }),
    previewInvite: ({ token, signal }) =>
      request('GET', `/v1/invites/${encodeURIComponent(token)}`, InvitePreviewResponse, { signal }),
    acceptInvite: ({ idToken, token, signal }) =>
      request('POST', `/v1/invites/${encodeURIComponent(token)}/accept`, CommunityResponse, {
        signal,
        headers: bearer(idToken),
        body: {},
      }),
    listSeasons: ({ idToken, tenantId, signal }) =>
      request('GET', `/v1/t/${encodeURIComponent(tenantId)}/seasons`, SeasonListResponse, {
        signal,
        headers: bearer(idToken),
      }),
    createSeason: ({ idToken, tenantId, body, signal }) =>
      request('POST', `/v1/t/${encodeURIComponent(tenantId)}/seasons`, SeasonView, {
        signal,
        headers: bearer(idToken),
        body,
      }),
    suggestRamadanStart: ({ idToken, tenantId, timezone, signal }) =>
      request(
        'GET',
        `/v1/t/${encodeURIComponent(tenantId)}/seasons/ramadan-suggestion?${new URLSearchParams({ timezone })}`,
        RamadanSuggestionResponse,
        { signal, headers: bearer(idToken) },
      ),
    listMembers: ({ idToken, tenantId, signal }) =>
      request('GET', `/v1/t/${encodeURIComponent(tenantId)}/members`, MembersResponse, {
        signal,
        headers: bearer(idToken),
      }),
    changeMemberRole: ({ idToken, tenantId, userId, body, signal }) =>
      request(
        'PATCH',
        `/v1/t/${encodeURIComponent(tenantId)}/members/${encodeURIComponent(userId)}`,
        MemberView,
        { signal, headers: bearer(idToken), body },
      ),
    removeMember: async ({ idToken, tenantId, userId, signal }) => {
      await send(
        'DELETE',
        `/v1/t/${encodeURIComponent(tenantId)}/members/${encodeURIComponent(userId)}`,
        {
          signal,
          headers: bearer(idToken),
        },
      );
    },
    leaveCommunity: async ({ idToken, tenantId, signal }) => {
      await send('POST', `/v1/t/${encodeURIComponent(tenantId)}/leave`, {
        signal,
        headers: bearer(idToken),
        body: {},
      });
    },
  };
}

export const apiClient = createApiClient();
