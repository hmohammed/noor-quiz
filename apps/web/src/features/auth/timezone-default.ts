import { UpdateMeRequest, type MeResponse } from '@noor/contracts';

/**
 * The patch that fills in a missing timezone from the browser, or null when the user
 * already has one, has not accepted the current consent (the API would refuse the
 * PATCH), or the browser zone is missing or not a valid IANA name.
 */
export function timezoneDefault(
  me: Pick<MeResponse, 'timezone' | 'consent'>,
  browserTz: string | undefined | null,
): { timezone: string } | null {
  if (me.consent.required) return null;
  if (me.timezone !== null || typeof browserTz !== 'string') return null;
  const parsed = UpdateMeRequest.safeParse({ timezone: browserTz });
  return parsed.success && parsed.data.timezone ? { timezone: browserTz } : null;
}

/** The browser's IANA zone, or undefined when the runtime does not report one. */
export function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
