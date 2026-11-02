## T030

**Season rules in core: days, open and close times**

Phase: P1 · Depends on: [T003](E00-foundation.md#t003) · Tags: —
Skills: `vertical-slice`

**Goal.** Pure, tested logic for when a season day starts and when its question opens and closes — the old app's biggest source of bugs.

**Scope**

- `Season` type: startDate (local date), lengthDays, timezone, opensAtLocal (HH:mm), closesAtLocal (HH:mm)
- Functions: `seasonState(season, now)`, `dayIndexAt(season, now)`, `questionWindow(season, dayIndex)`, `isOpen(...)`
- Hijri helper to suggest a Ramadan start date (Umm al-Qura via Intl) — suggestion only, admins confirm

**Acceptance criteria**

- [ ] Table tests in Europe/Stockholm, Africa/Addis_Ababa, America/Toronto, Asia/Riyadh including a DST change night
- [ ] Close time after midnight (e.g. 01:00) is handled
- [ ] Day index never exceeds lengthDays; pre/post states correct at boundaries (±1 minute)

**Notes**

_(implementer adds notes for the next task here)_

Tags: 
Phase: P1
