import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { CreateSeasonRequest, type SeasonView } from '@noor/contracts';
import { useSession, type Session } from '../auth/session-context';
import {
  applyRamadanSuggestion,
  SeasonsView,
  type SeasonFormStatus,
  type SeasonFormValues,
  type SeasonsViewState,
} from './SeasonsView';

function supportedTimeZones(): readonly string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

const reloadPage = () => window.location.reload();

const emptyValues = (timezone: string): SeasonFormValues => ({
  name: '',
  kind: 'ramadan',
  timezone,
  startDate: '',
  lengthDays: '',
  opensAtLocal: '',
  closesAtLocal: '',
});

/** List a community's seasons and, for an admin, create one. Talks to the API only through the session. */
export function SeasonsPage() {
  const session = useSession();
  const { tenantId = '' } = useParams();
  const timeZones = useMemo(supportedTimeZones, []);
  const { state } = session;

  if (state.kind === 'signed-in') {
    return (
      <SeasonsEditor
        key={`${state.me.userId}:${tenantId}`}
        tenantId={tenantId}
        timeZones={timeZones}
        listMyCommunities={session.listMyCommunities}
        listSeasons={session.listSeasons}
        createSeason={session.createSeason}
        suggestRamadanStart={session.suggestRamadanStart}
      />
    );
  }

  const viewState: SeasonsViewState =
    state.kind === 'loading'
      ? { kind: 'loading' }
      : state.kind === 'error'
        ? { kind: 'error' }
        : state.kind === 'unavailable'
          ? { kind: 'unavailable' }
          : { kind: 'signed-out' };

  return (
    <SeasonsView
      state={viewState}
      timeZones={timeZones}
      onNameChange={() => undefined}
      onKindChange={() => undefined}
      onTimezoneChange={() => undefined}
      onStartDateChange={() => undefined}
      onLengthChange={() => undefined}
      onOpensChange={() => undefined}
      onClosesChange={() => undefined}
      onSubmit={() => undefined}
      onSuggest={() => undefined}
      onSignIn={session.signIn}
      onRetry={reloadPage}
    />
  );
}

function SeasonsEditor({
  tenantId,
  timeZones,
  listMyCommunities,
  listSeasons,
  createSeason,
  suggestRamadanStart,
}: {
  tenantId: string;
  timeZones: readonly string[];
  listMyCommunities: Session['listMyCommunities'];
  listSeasons: Session['listSeasons'];
  createSeason: Session['createSeason'];
  suggestRamadanStart: Session['suggestRamadanStart'];
}) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [role, setRole] = useState<'member' | 'scholar-reviewer' | 'editor' | 'admin' | 'owner'>(
    'member',
  );
  const [seasons, setSeasons] = useState<readonly SeasonView[]>([]);
  const [values, setValues] = useState<SeasonFormValues>(() => emptyValues(''));
  const [status, setStatus] = useState<SeasonFormStatus>('idle');

  useEffect(() => {
    let cancelled = false;
    listMyCommunities()
      .then(async (mine) => {
        const community = mine.communities.find((item) => item.tenantId === tenantId);
        if (!community) throw new Error('missing community');
        const listed = await listSeasons(tenantId);
        return { community, seasons: listed.seasons };
      })
      .then(
        (loaded) => {
          if (cancelled) return;
          setRole(loaded.community.role);
          setSeasons(loaded.seasons);
          setValues((current) =>
            current.timezone === '' ? emptyValues(loaded.community.timezone) : current,
          );
          setPhase('ready');
        },
        () => {
          if (!cancelled) setPhase('error');
        },
      );
    return () => {
      cancelled = true;
    };
  }, [listMyCommunities, listSeasons, tenantId, attempt]);

  const noop = () => undefined;
  if (phase === 'loading') {
    return (
      <SeasonsView
        state={{ kind: 'loading' }}
        timeZones={timeZones}
        onNameChange={noop}
        onKindChange={noop}
        onTimezoneChange={noop}
        onStartDateChange={noop}
        onLengthChange={noop}
        onOpensChange={noop}
        onClosesChange={noop}
        onSubmit={noop}
        onSuggest={noop}
      />
    );
  }
  if (phase === 'error') {
    return (
      <SeasonsView
        state={{ kind: 'error' }}
        timeZones={timeZones}
        onNameChange={noop}
        onKindChange={noop}
        onTimezoneChange={noop}
        onStartDateChange={noop}
        onLengthChange={noop}
        onOpensChange={noop}
        onClosesChange={noop}
        onSubmit={noop}
        onSuggest={noop}
        onRetry={() => {
          setPhase('loading');
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  const refreshList = () => {
    listSeasons(tenantId).then(
      (res) => {
        setSeasons(res.seasons);
        setStatus('idle');
      },
      () => setStatus('list-error'),
    );
  };

  const handleSubmit = () => {
    if (status === 'saving' || status === 'suggesting' || status === 'list-error') return;
    const lengthDays = values.lengthDays.trim() === '' ? Number.NaN : Number(values.lengthDays);
    const parsed = CreateSeasonRequest.safeParse({ ...values, lengthDays });
    if (!parsed.success) {
      setStatus('invalid');
      return;
    }
    setStatus('saving');
    createSeason(tenantId, parsed.data).then(
      () => {
        setValues((current) => ({ ...current, name: '' }));
        refreshList();
      },
      () => setStatus('error'),
    );
  };

  const handleSuggest = () => {
    if (status === 'saving' || status === 'suggesting') return;
    if (values.timezone === '') {
      if (status !== 'list-error') setStatus('invalid');
      return;
    }
    const returnToListError = status === 'list-error';
    setStatus('suggesting');
    suggestRamadanStart(tenantId, values.timezone).then(
      (suggestion) => {
        setValues((current) => applyRamadanSuggestion(current, suggestion));
        setStatus(returnToListError ? 'list-error' : 'idle');
      },
      () => setStatus('suggest-error'),
    );
  };

  const leaveStatus = () => {
    if (status !== 'saving' && status !== 'suggesting' && status !== 'list-error')
      setStatus('idle');
  };

  return (
    <SeasonsView
      state={{ kind: 'ready', role, status, values, seasons }}
      timeZones={timeZones}
      onNameChange={(name) => {
        setValues((current) => ({ ...current, name }));
        leaveStatus();
      }}
      onKindChange={(kind) => {
        setValues((current) => ({ ...current, kind }));
        leaveStatus();
      }}
      onTimezoneChange={(timezone) => {
        setValues((current) => ({ ...current, timezone }));
        leaveStatus();
      }}
      onStartDateChange={(startDate) => {
        setValues((current) => ({ ...current, startDate }));
        leaveStatus();
      }}
      onLengthChange={(lengthDays) => {
        setValues((current) => ({ ...current, lengthDays }));
        leaveStatus();
      }}
      onOpensChange={(opensAtLocal) => {
        setValues((current) => ({ ...current, opensAtLocal }));
        leaveStatus();
      }}
      onClosesChange={(closesAtLocal) => {
        setValues((current) => ({ ...current, closesAtLocal }));
        leaveStatus();
      }}
      onSubmit={handleSubmit}
      onSuggest={handleSuggest}
      onRetry={refreshList}
    />
  );
}
