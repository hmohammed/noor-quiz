import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type {
  ChangeMemberRoleRequestInput,
  CommunityResponse,
  CreateCommunityRequestInput,
  CreateInviteRequestInput,
  CreateInviteResponse,
  CreateSeasonRequestInput,
  MeResponse,
  MembersResponse,
  MemberView,
  MyCommunitiesResponse,
  RamadanSuggestionResponse,
  SeasonListResponse,
  SeasonView,
  UpdateMeRequestInput,
} from '@noor/contracts';
import { ApiError, apiClient } from '../../api/client';
import {
  SessionError,
  getIdToken,
  isConfigured,
  onChange,
  signIn as sessionSignIn,
  signOut as sessionSignOut,
} from '../../auth/session';
import { ConsentOutdatedError, acceptCurrentConsent } from './accept-consent';
import { browserTimeZone, timezoneDefault } from './timezone-default';

export type SessionState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'signed-out' }
  | { kind: 'signed-in'; me: MeResponse }
  | { kind: 'error'; hasSession: boolean };

export interface Session {
  state: SessionState;
  signIn(): void;
  signOut(): void;
  /** Saves a profile patch through the API and replaces `me` on success. */
  updateMe(patch: UpdateMeRequestInput): Promise<MeResponse>;
  /**
   * Accepts the consent version the server asked for and replaces `me`. Throws
   * ConsentOutdatedError (after replacing `me`) when the terms changed meanwhile.
   */
  acceptConsent(): Promise<MeResponse>;
  /** Deletes the account, then signs out. A failed delete leaves the session signed in. */
  deleteAccount(): Promise<void>;
  /** Creates a community. Does not store the community list on the session. */
  createCommunity(body: CreateCommunityRequestInput): Promise<CommunityResponse>;
  /** Loads the signed-in user's communities. Does not store them on the session. */
  listMyCommunities(): Promise<MyCommunitiesResponse>;
  /** Creates an invite. The body is the caller's limits only; `{}` uses the defaults. */
  createInvite(tenantId: string, body: CreateInviteRequestInput): Promise<CreateInviteResponse>;
  /** Accepts an invite and returns the community summary. Does not store it on the session. */
  acceptInvite(token: string): Promise<CommunityResponse>;
  /** Seasons for one community. Does not store them on the session. */
  listSeasons(tenantId: string): Promise<SeasonListResponse>;
  /** Creates a season. Does not store the season list on the session. */
  createSeason(tenantId: string, body: CreateSeasonRequestInput): Promise<SeasonView>;
  /** Fills a suggestion. Does not create a season. */
  suggestRamadanStart(tenantId: string, timezone: string): Promise<RamadanSuggestionResponse>;
  /** Members of one community. Does not store them on the session. */
  listMembers(tenantId: string): Promise<MembersResponse>;
  /** Proposes a role. Does not store the member list on the session. */
  changeMemberRole(
    tenantId: string,
    userId: string,
    body: ChangeMemberRoleRequestInput,
  ): Promise<MemberView>;
  /** Removes someone else. */
  removeMember(tenantId: string, userId: string): Promise<void>;
  /** Leaves one community. Does not store the community list on the session. */
  leaveCommunity(tenantId: string): Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

/**
 * The one place that loads `/v1/me`. Shows only what the API returns, never Firebase
 * user data. After the first load it fills a missing timezone from the browser.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(() =>
    isConfigured() ? { kind: 'loading' } : { kind: 'unavailable' },
  );
  // Bumped on every auth change and on unmount, so a late API result is dropped.
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  // Read by callbacks so they see the latest `me` without being recreated on every render.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Fire-and-forget: a failure leaves the user without a timezone, as before.
  const applyTimezoneDefault = useCallback(
    (
      idToken: string,
      me: MeResponse,
      { signal, isCurrent }: { signal?: AbortSignal; isCurrent: () => boolean },
    ) => {
      const body = timezoneDefault(me, browserTimeZone());
      if (body === null || !isCurrent()) return;
      apiClient.updateMe({ idToken, body, signal }).then(
        (updated) => {
          if (isCurrent()) setState({ kind: 'signed-in', me: updated });
        },
        () => undefined,
      );
    },
    [],
  );
  // Hoisted so deleteAccount can cancel an in-flight /v1/me load, the timezone-default
  // PATCH, and updateMe before the DELETE. A late PATCH would run requireUser() and
  // recreate the user that was just deleted.
  const cancelPending = useCallback(() => {
    generation.current += 1;
    pending.current?.abort();
    pending.current = null;
  }, []);

  useEffect(() => {
    if (!isConfigured()) return;

    const unsubscribe = onChange((signedIn) => {
      cancelPending();
      if (!signedIn) {
        setState({ kind: 'signed-out' });
        return;
      }
      const current = generation.current;
      const controller = new AbortController();
      pending.current = controller;
      const isCurrent = () => !controller.signal.aborted && current === generation.current;

      setState({ kind: 'loading' });
      getIdToken()
        .then((idToken) => {
          if (idToken === null) return null;
          return apiClient.getMe({ idToken, signal: controller.signal }).then((me) => {
            if (isCurrent()) {
              applyTimezoneDefault(idToken, me, { signal: controller.signal, isCurrent });
            }
            return me;
          });
        })
        .then(
          (me) => {
            if (!isCurrent()) return;
            setState(me === null ? { kind: 'signed-out' } : { kind: 'signed-in', me });
          },
          () => {
            if (isCurrent()) setState({ kind: 'error', hasSession: true });
          },
        );
    });

    return () => {
      unsubscribe();
      cancelPending();
    };
  }, [applyTimezoneDefault, cancelPending]);

  const signIn = useCallback(() => {
    setState({ kind: 'loading' });
    // On success the onChange subscription takes over and loads /v1/me.
    sessionSignIn().catch((err: unknown) => {
      const cancelled = err instanceof SessionError && err.code === 'cancelled';
      setState(cancelled ? { kind: 'signed-out' } : { kind: 'error', hasSession: false });
    });
  }, []);

  const signOut = useCallback(() => {
    sessionSignOut().catch(() => setState({ kind: 'error', hasSession: true }));
  }, []);

  const updateMe = useCallback(async (patch: UpdateMeRequestInput) => {
    const current = generation.current;
    const idToken = await getIdToken();
    // deleteAccount bumps generation and aborts `pending` before DELETE. Do not start
    // the PATCH after that, or requireUser() would create a new account.
    if (current !== generation.current) throw new ApiError('Not signed in', { status: 401 });
    if (idToken === null) throw new ApiError('Not signed in', { status: 401 });
    let controller = pending.current;
    if (!controller || controller.signal.aborted) {
      controller = new AbortController();
      pending.current = controller;
    }
    const me = await apiClient.updateMe({
      idToken,
      body: patch,
      signal: controller.signal,
    });
    if (current === generation.current) setState({ kind: 'signed-in', me });
    return me;
  }, []);

  const acceptConsent = useCallback(async () => {
    const current = generation.current;
    const isCurrent = () => current === generation.current;
    const snapshot = stateRef.current;
    if (snapshot.kind !== 'signed-in') throw new ApiError('Not signed in', { status: 401 });
    const idToken = await getIdToken();
    if (idToken === null) throw new ApiError('Not signed in', { status: 401 });
    try {
      const me = await acceptCurrentConsent(apiClient, { idToken, me: snapshot.me });
      if (isCurrent()) {
        setState({ kind: 'signed-in', me });
        // Same controller deleteAccount aborts. The sign-in load never sends this PATCH,
        // because timezoneDefault waits until consent is accepted.
        let controller = pending.current;
        if (!controller || controller.signal.aborted) {
          controller = new AbortController();
          pending.current = controller;
        }
        applyTimezoneDefault(idToken, me, { signal: controller.signal, isCurrent });
      }
      return me;
    } catch (err) {
      if (err instanceof ConsentOutdatedError && isCurrent()) {
        setState({ kind: 'signed-in', me: err.me });
      }
      throw err;
    }
  }, [applyTimezoneDefault]);

  const withToken = useCallback(
    async <T,>(run: (idToken: string, signal: AbortSignal) => Promise<T>) => {
      const current = generation.current;
      const idToken = await getIdToken();
      if (current !== generation.current) throw new ApiError('Not signed in', { status: 401 });
      if (idToken === null) throw new ApiError('Not signed in', { status: 401 });
      let controller = pending.current;
      if (!controller || controller.signal.aborted) {
        controller = new AbortController();
        pending.current = controller;
      }
      return run(idToken, controller.signal);
    },
    [],
  );

  const createCommunity = useCallback(
    (body: CreateCommunityRequestInput) =>
      withToken((idToken, signal) => apiClient.createCommunity({ idToken, body, signal })),
    [withToken],
  );

  const listMyCommunities = useCallback(
    () => withToken((idToken, signal) => apiClient.listMyCommunities({ idToken, signal })),
    [withToken],
  );

  const createInvite = useCallback(
    (tenantId: string, body: CreateInviteRequestInput) =>
      withToken((idToken, signal) => apiClient.createInvite({ idToken, tenantId, body, signal })),
    [withToken],
  );

  const acceptInvite = useCallback(
    (token: string) =>
      withToken((idToken, signal) => apiClient.acceptInvite({ idToken, token, signal })),
    [withToken],
  );

  const listSeasons = useCallback(
    (tenantId: string) =>
      withToken((idToken, signal) => apiClient.listSeasons({ idToken, tenantId, signal })),
    [withToken],
  );

  const createSeason = useCallback(
    (tenantId: string, body: CreateSeasonRequestInput) =>
      withToken((idToken, signal) => apiClient.createSeason({ idToken, tenantId, body, signal })),
    [withToken],
  );

  const suggestRamadanStart = useCallback(
    (tenantId: string, timezone: string) =>
      withToken((idToken, signal) =>
        apiClient.suggestRamadanStart({ idToken, tenantId, timezone, signal }),
      ),
    [withToken],
  );

  const listMembers = useCallback(
    (tenantId: string) =>
      withToken((idToken, signal) => apiClient.listMembers({ idToken, tenantId, signal })),
    [withToken],
  );

  const changeMemberRole = useCallback(
    (tenantId: string, userId: string, body: ChangeMemberRoleRequestInput) =>
      withToken((idToken, signal) =>
        apiClient.changeMemberRole({ idToken, tenantId, userId, body, signal }),
      ),
    [withToken],
  );

  const removeMember = useCallback(
    (tenantId: string, userId: string) =>
      withToken((idToken, signal) => apiClient.removeMember({ idToken, tenantId, userId, signal })),
    [withToken],
  );

  const leaveCommunity = useCallback(
    (tenantId: string) =>
      withToken((idToken, signal) => apiClient.leaveCommunity({ idToken, tenantId, signal })),
    [withToken],
  );

  const deleteAccount = useCallback(async () => {
    cancelPending();
    const idToken = await getIdToken();
    if (idToken === null) throw new ApiError('Not signed in', { status: 401 });
    await apiClient.deleteMe({ idToken });
    try {
      await sessionSignOut();
    } catch {
      // The account is already gone. Sign-out failed, so keep a session error and resolve.
      setState({ kind: 'error', hasSession: true });
    }
  }, [cancelPending]);

  const value = useMemo(
    () => ({
      state,
      signIn,
      signOut,
      updateMe,
      acceptConsent,
      deleteAccount,
      createCommunity,
      listMyCommunities,
      createInvite,
      acceptInvite,
      listSeasons,
      createSeason,
      suggestRamadanStart,
      listMembers,
      changeMemberRole,
      removeMember,
      leaveCommunity,
    }),
    [
      state,
      signIn,
      signOut,
      updateMe,
      acceptConsent,
      deleteAccount,
      createCommunity,
      listMyCommunities,
      createInvite,
      acceptInvite,
      listSeasons,
      createSeason,
      suggestRamadanStart,
      listMembers,
      changeMemberRole,
      removeMember,
      leaveCommunity,
    ],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession() needs a <SessionProvider>');
  return session;
}
