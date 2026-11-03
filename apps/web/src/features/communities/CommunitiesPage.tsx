import { useEffect, useMemo, useRef, useState } from 'react';
import { CreateCommunityRequest, type CommunitySummary, type MeResponse } from '@noor/contracts';
import { useSession, type Session } from '../auth/session-context';
import { browserTimeZone } from '../auth/timezone-default';
import { InviteDialog, type InviteDialogState } from '../invites/InviteDialog';
import { joinUrl } from '../invites/join-url';
import {
  CommunitiesView,
  type CommunitiesViewState,
  type CommunityFormStatus,
  type CommunityFormValues,
} from './CommunitiesView';

function supportedTimeZones(): readonly string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

/** `me.timezone` when set, otherwise the browser zone when that list contains it. */
function initialTimezone(me: MeResponse, zones: readonly string[]): string {
  if (me.timezone) return me.timezone;
  const browser = browserTimeZone();
  if (browser && zones.includes(browser)) return browser;
  return '';
}

const reloadPage = () => window.location.reload();

type InviteUi =
  | { kind: 'closed' }
  | { kind: 'loading'; community: CommunitySummary }
  | { kind: 'error'; community: CommunitySummary }
  | {
      kind: 'ready';
      community: CommunitySummary;
      token: string;
      expiresAt: string;
      copy: 'idle' | 'copied' | 'failed';
    };

/** Create a community and list the ones I belong to. Talks to the API only through the session. */
export function CommunitiesPage() {
  const session = useSession();
  const timeZones = useMemo(supportedTimeZones, []);
  const { state } = session;

  if (state.kind === 'signed-in') {
    return (
      <CommunitiesEditor
        key={state.me.userId}
        me={state.me}
        timeZones={timeZones}
        createCommunity={session.createCommunity}
        listMyCommunities={session.listMyCommunities}
        createInvite={session.createInvite}
      />
    );
  }

  const viewState: CommunitiesViewState =
    state.kind === 'loading'
      ? { kind: 'loading' }
      : state.kind === 'error'
        ? { kind: 'error' }
        : state.kind === 'unavailable'
          ? { kind: 'unavailable' }
          : { kind: 'signed-out' };

  return (
    <CommunitiesView
      state={viewState}
      timeZones={timeZones}
      onNameChange={() => undefined}
      onTimezoneChange={() => undefined}
      onSubmit={() => undefined}
      onSignIn={session.signIn}
      onRetry={reloadPage}
    />
  );
}

function CommunitiesEditor({
  me,
  timeZones,
  createCommunity,
  listMyCommunities,
  createInvite,
}: {
  me: MeResponse;
  timeZones: readonly string[];
  createCommunity: Session['createCommunity'];
  listMyCommunities: Session['listMyCommunities'];
  createInvite: Session['createInvite'];
}) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [communities, setCommunities] = useState<readonly CommunitySummary[]>([]);
  const [values, setValues] = useState<CommunityFormValues>(() => ({
    name: '',
    timezone: initialTimezone(me, timeZones),
  }));
  const [status, setStatus] = useState<CommunityFormStatus>('idle');
  const [invite, setInvite] = useState<InviteUi>({ kind: 'closed' });
  const inviteRequest = useRef(0);

  useEffect(() => {
    let cancelled = false;
    listMyCommunities().then(
      (res) => {
        if (cancelled) return;
        setCommunities(res.communities);
        setPhase('ready');
      },
      () => {
        if (!cancelled) setPhase('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [listMyCommunities, attempt]);

  if (phase === 'loading') {
    return (
      <CommunitiesView
        state={{ kind: 'loading' }}
        timeZones={timeZones}
        onNameChange={() => undefined}
        onTimezoneChange={() => undefined}
        onSubmit={() => undefined}
      />
    );
  }
  if (phase === 'error') {
    return (
      <CommunitiesView
        state={{ kind: 'error' }}
        timeZones={timeZones}
        onNameChange={() => undefined}
        onTimezoneChange={() => undefined}
        onSubmit={() => undefined}
        onRetry={() => {
          setPhase('loading');
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  const refreshList = () => {
    listMyCommunities().then(
      (res) => {
        setCommunities(res.communities);
        setStatus('idle');
      },
      () => setStatus('list-error'),
    );
  };

  const handleSubmit = () => {
    if (status === 'saving' || status === 'list-error') return;
    if (values.timezone === '') {
      setStatus('invalid-timezone');
      return;
    }
    const parsed = CreateCommunityRequest.safeParse(values);
    if (!parsed.success) {
      const nameInvalid = parsed.error.issues.some((issue) => issue.path[0] === 'name');
      setStatus(nameInvalid ? 'invalid-name' : 'invalid-timezone');
      return;
    }
    setStatus('saving');
    createCommunity({ name: values.name, timezone: values.timezone }).then(
      () => {
        setValues((current) => ({ ...current, name: '' }));
        refreshList();
      },
      () => setStatus('error'),
    );
  };

  function openInvite(community: CommunitySummary) {
    const id = inviteRequest.current + 1;
    inviteRequest.current = id;
    setInvite({ kind: 'loading', community });
    createInvite(community.tenantId, {}).then(
      (res) => {
        if (inviteRequest.current !== id) return;
        setInvite({
          kind: 'ready',
          community,
          token: res.token,
          expiresAt: res.expiresAt,
          copy: 'idle',
        });
      },
      () => {
        if (inviteRequest.current !== id) return;
        setInvite({ kind: 'error', community });
      },
    );
  }

  async function copyLink() {
    if (invite.kind !== 'ready') return;
    const url = joinUrl(invite.token, window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
      setInvite({ ...invite, copy: 'copied' });
    } catch {
      setInvite({ ...invite, copy: 'failed' });
    }
  }

  const dialog: InviteDialogState | null =
    invite.kind === 'closed'
      ? null
      : invite.kind === 'loading'
        ? { kind: 'loading' }
        : invite.kind === 'error'
          ? { kind: 'error' }
          : {
              kind: 'ready',
              url: joinUrl(invite.token, window.location.origin),
              expiresAt: invite.expiresAt,
              timeZone: invite.community.timezone,
              copy: invite.copy,
            };

  return (
    <>
      <CommunitiesView
        state={{ kind: 'ready', status, values, communities }}
        timeZones={timeZones}
        onNameChange={(name) => {
          setValues((current) => ({ ...current, name }));
          if (status !== 'saving' && status !== 'list-error') setStatus('idle');
        }}
        onTimezoneChange={(timezone) => {
          setValues((current) => ({ ...current, timezone }));
          if (status !== 'saving' && status !== 'list-error') setStatus('idle');
        }}
        onSubmit={handleSubmit}
        onRetry={refreshList}
        onInvite={openInvite}
      />
      {dialog && (
        <InviteDialog
          state={dialog}
          onClose={() => {
            inviteRequest.current += 1;
            setInvite({ kind: 'closed' });
          }}
          onRetry={() => {
            if (invite.kind === 'error') openInvite(invite.community);
          }}
          onCopy={() => {
            void copyLink();
          }}
        />
      )}
    </>
  );
}
