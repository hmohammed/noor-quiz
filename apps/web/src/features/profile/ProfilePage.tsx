import { useMemo, useState } from 'react';
import { UpdateMeRequest, type MeResponse, type UpdateMeRequestInput } from '@noor/contracts';
import { ApiError } from '../../api/client';
import { useSession } from '../auth/session-context';
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

/** Edit my display name, language and timezone. Saves through `PATCH /v1/me` only. */
export function ProfilePage() {
  const session = useSession();
  const timeZones = useMemo(supportedTimeZones, []);
  // Edited fields only, so a later `me` (e.g. the browser timezone default) still shows.
  const [draft, setDraft] = useState<Partial<ProfileValues>>({});
  const [status, setStatus] = useState<ProfileFormStatus>('idle');

  const { state } = session;
  const me = state.kind === 'signed-in' ? state.me : null;
  const values: ProfileValues | null = me ? { ...valuesOf(me), ...draft } : null;

  const viewState: ProfileViewState =
    values !== null
      ? { kind: 'form', status, values }
      : state.kind === 'loading'
        ? { kind: 'loading' }
        : state.kind === 'error'
          ? { kind: 'error' }
          : { kind: 'signed-out' };

  const handleChange = <K extends keyof ProfileValues>(field: K, value: ProfileValues[K]) => {
    setDraft((d) => ({ ...d, [field]: value }));
    if (status !== 'saving') setStatus('idle');
  };

  const handleSubmit = () => {
    if (!me || !values || status === 'saving') return;
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
    session.updateMe(patch).then(
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
      state={viewState}
      timeZones={timeZones}
      onChange={handleChange}
      onSubmit={handleSubmit}
    />
  );
}
