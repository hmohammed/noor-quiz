import type { MeResponse } from '@noor/contracts';
import { ApiError, type ApiClient } from '../../api/client';

/** The terms changed while the user was reading them. `me` is the reloaded user. */
export class ConsentOutdatedError extends Error {
  override name = 'ConsentOutdatedError';

  constructor(readonly me: MeResponse) {
    super('Consent version is outdated');
  }
}

/** POSTs `me.consent.currentVersion`. On 409, reloads `/v1/me` and throws ConsentOutdatedError(freshMe). */
export async function acceptCurrentConsent(
  client: Pick<ApiClient, 'acceptConsent' | 'getMe'>,
  init: { idToken: string; me: MeResponse },
): Promise<MeResponse> {
  const { idToken, me } = init;
  try {
    return await client.acceptConsent({ idToken, body: { version: me.consent.currentVersion } });
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 409) throw err;
  }
  const fresh = await client.getMe({ idToken });
  throw new ConsentOutdatedError(fresh);
}
