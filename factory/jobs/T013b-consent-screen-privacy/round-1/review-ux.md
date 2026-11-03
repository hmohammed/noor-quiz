VERDICT: PASS
# UX review — T013b round 1

Reviewed in the worktree: `ConsentGateView.tsx`, `ConsentGate.tsx`, `PrivacyPage.tsx`, `AppLayout.tsx`, `policy.ts`, `en.json` and the `styles.css` diff. I did not re-run the e2e suite. I read build.md's results and the code.

## Findings
None blocking.

What I checked and found fine:
- **Flow:** A new member sees one heading, a short summary, a privacy link and one primary button, and nothing else on the page. "I agree" is the only primary action. The header and sign-out stay available, so a member who declines can leave. `/privacy` opens from the gate and from the footer. `Home` returns to the gate. The `Profile` link is hidden while consent is pending, so there is no link that leads to a blocked screen.
- **States:** All four states exist in `ConsentGateView`.
  - `idle`: the button is enabled.
  - `accepting`: the button is `disabled` and its text changes to `consent.agreeing`. `ConsentGate.handleAccept` also returns early while `status === 'accepting'`, so a double submit is blocked even on a fast second tap.
  - `error`: a `role="alert"` shows `consent.error.generic`, and the button is enabled again so the user can retry.
  - `outdated`: a `role="alert"` shows its own copy, and the button is enabled.
  - The success state is the gate disappearing, because the session's `me` changes. `<ConsentGate key={userId}>` stops a previous member's error from carrying over to another member.
- **Copy:** Every string goes through `t()`, and every key is in `en.json`.
  - The wording is plain and kind. "Saving your answer…" and "We couldn't save your answer. Please try again." do not blame the user. The outdated message says what happened and what to do next.
  - The privacy placeholder says the final text will follow, and it makes no compliance claims.
- **Accessibility:**
  - The gate and `/privacy` are `<main>` landmarks with a single `<h1>`, and the privacy sections use `<h2>`.
  - The button is a real `<button type="button">`. Links are real `<Link>`s.
  - Both reuse the existing focus-visible outlines. Touch targets are at least 2.75rem (`.auth__button`, `.site-nav__link`), and the footer link gets the same size.
  - Errors use `role="alert"`, and the loading line uses `role="status"`.
  - Muted and error text use the existing colour variables.
- **RTL:** The new CSS uses logical properties only: `margin-block`, `padding-inline`, `border-block-start`, `flex` with `gap`. There is no `left` or `right`. Nothing is clipped or truncated, and the text wraps. The content is Latin, with no direction-specific layout.
- **Spoilers:** Not applicable. No question or answer content is involved.

## Nits (non-blocking)
- apps/web/src/features/consent/ConsentGateView.tsx:30 — While accepting, the button text and the status `<p>` both say "Saving your answer…". build.md already notes that a screen reader may hear it twice. This is fine for now. Once a visually-hidden class exists, consider making the status line the only announcement.
- apps/web/src/features/consent/ConsentGateView.tsx:25 — Disabling the button while the request runs can make a keyboard user lose focus. When the button is enabled again after an error, focus is not restored, so the user has to tab back to it. Consider `aria-disabled` instead of `disabled`, or moving focus to the alert or the button on error. Fix this in a later accessibility pass.
- apps/web/src/features/privacy/PrivacyPage.tsx — A member who opens `/privacy` from the gate has no direct "back to agree" link. They have to use the `Home` nav link. This works, and test 13 covers it. A "Back" link shown only while consent is pending would be kinder, but it is not needed now.
- apps/web/src/styles.css — `.site-footer` runs the full width, while `.page` is capped at 40rem and centred. On wide screens the footer link sits at the page edge, away from the content. Purely visual, and the CSS is otherwise consistent.
- apps/web/src/i18n/en.json `privacy.rights.body` — This says "You will be able to delete your account", which T013c delivers. Reword it if T013c slips, as build.md notes.
