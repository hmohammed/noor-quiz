# Rework — T013c

Abort the timezone save that starts when consent is accepted, using the same cancellation as a profile save.

After consent, `applyTimezoneDefault` starts `PATCH /v1/me` with no `AbortSignal` and does not keep that request on `pending`. `deleteAccount` only aborts `pending`, so that PATCH can still reach `requireUser()` after `DELETE /v1/me` and create a new user. Store a controller on `pending` the way `updateMe` does, pass its signal into this `applyTimezoneDefault` call, and start the PATCH only when the generation has not already moved.

Fix only this. Leave the non-blocking notes from earlier rounds.
