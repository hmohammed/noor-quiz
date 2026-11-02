import { useMemo, useState } from 'react';
import { UpdateMeRequest, type MeResponse, type UpdateMeRequestInput } from '@noor/contracts';
import { ApiError } from '../../api/client';
import { useSession, type Session } from '../auth/session-context';
import {
  ProfileFormView,
  type ProfileFormStatus,
  type ProfileValues,
  type ProfileViewState,
} from './ProfileFormView';

function supportedTimeZones(): readonly string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

function valuesOf(me: MeResponse): ProfileValues {
  return {
    displayName: me.displayName ?? '',
    locale: me.locale ?? '',
    timezone: me.timezone ?? '',
  };
}

/** Only the fields the member changed. */
function changedFields(me: MeResponse, values: ProfileValues): UpdateMeRequestInput {
  const saved = valuesOf(me);
  const patch: UpdateMeRequestInput = {};
  if (values.displayName !== saved.displayName) patch.displayName = values.displayName;
  if (values.locale !== saved.locale && values.locale !== '') patch.locale = values.locale;
  if (values.timezone !== saved.timezone && values.timezone !== '') {
    patch.timezone = values.timezone;
  }
  return patch;
}

const reloadPage = () => window.location.reload();

/** Edit my display name, language and timezone. Saves through `PATCH /v1/me` only. */
export function ProfilePage() {
  const session = useSession();
  const timeZones = useMemo(supportedTimeZones, []);
  const { state } = session;

  if (state.kind === 'signed-in') {
    // Keyed by user, so one member's unsaved edits never show in another member's form.
    return (
      <ProfileEditor
        key={state.me.userId}
        me={state.me}
        updateMe={session.updateMe}
        timeZones={timeZones}
      />
    );
  }

  const viewState: ProfileViewState =
    state.kind === 'loading'
      ? { kind: 'loading' }
      : state.kind === 'error'
        ? { kind: 'error' }
        : state.kind === 'unavailable'
          ? { kind: 'unavailable' }
          : { kind: 'signed-out' };

  return (
    <ProfileFormView
      state={viewState}
      timeZones={timeZones}
      onChange={() => undefined}
      onSubmit={() => undefined}
      onSignIn={session.signIn}
      onRetry={reloadPage}
    />
  );
}

function ProfileEditor({
  me,
  updateMe,
  timeZones,
}: {
  me: MeResponse;
  updateMe: Session['updateMe'];
  timeZones: readonly string[];
}) {
  // Edited fields only, so a later `me` (e.g. the browser timezone default) still shows.
  const [draft, setDraft] = useState<Partial<ProfileValues>>({});
  const [status, setStatus] = useState<ProfileFormStatus>('idle');
  const values: ProfileValues = { ...valuesOf(me), ...draft };

  const handleChange = <K extends keyof ProfileValues>(field: K, value: ProfileValues[K]) => {
    setDraft((d) => ({ ...d, [field]: value }));
    if (status !== 'saving') setStatus('idle');
  };

  const handleSubmit = () => {
    if (status === 'saving') return;
    const patch = changedFields(me, values);
    if (Object.keys(patch).length === 0) {
      setStatus('saved');
      return;
    }
    const parsed = UpdateMeRequest.safeParse(patch);
    if (!parsed.success) {
      const nameInvalid = parsed.error.issues.some((i) => i.path[0] === 'displayName');
      setStatus(nameInvalid ? 'invalid-name' : 'error');
      return;
    }
    setStatus('saving');
    updateMe(patch).then(
      () => {
        setDraft({});
        setStatus('saved');
      },
      (err: unknown) => {
        const badRequest = err instanceof ApiError && err.status === 400;
        setStatus(badRequest && patch.displayName !== undefined ? 'invalid-name' : 'error');
      },
    );
  };

  return (
    <ProfileFormView
      state={{ kind: 'form', status, values }}
      timeZones={timeZones}
      onChange={handleChange}
      onSubmit={handleSubmit}
    />
  );
}
