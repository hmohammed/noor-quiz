import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SeasonView } from '@noor/contracts';
import en from '../../i18n/en.json';
import {
  applyRamadanSuggestion,
  SeasonsView,
  type SeasonFormValues,
  type SeasonsViewState,
} from './SeasonsView';

const noop = () => undefined;
const ZONES = ['Europe/Stockholm'];
const VALUES: SeasonFormValues = {
  name: '',
  kind: 'ramadan',
  timezone: 'Europe/Stockholm',
  startDate: '',
  lengthDays: '',
  opensAtLocal: '',
  closesAtLocal: '',
};

const season: SeasonView = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  tenantId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  name: 'Ramadan 1448',
  kind: 'ramadan',
  startDate: '2035-01-01',
  lengthDays: 30,
  timezone: 'Europe/Stockholm',
  opensAtLocal: '08:00',
  closesAtLocal: '21:00',
  state: { phase: 'upcoming' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const render = (state: SeasonsViewState) =>
  renderToStaticMarkup(
    <SeasonsView
      state={state}
      timeZones={ZONES}
      onNameChange={noop}
      onKindChange={noop}
      onTimezoneChange={noop}
      onStartDateChange={noop}
      onLengthChange={noop}
      onOpensChange={noop}
      onClosesChange={noop}
      onSubmit={noop}
      onSuggest={noop}
    />,
  );

describe('SeasonsView', () => {
  it('lists the season name and the upcoming state', () => {
    const html = render({
      kind: 'ready',
      role: 'member',
      status: 'idle',
      values: VALUES,
      seasons: [season],
    });
    expect(html).toContain('Ramadan 1448');
    expect(html).toContain(en['season.state.upcoming']);
    expect(html).toMatch(/<span class="season__name" dir="auto">/);
    expect(html).toContain('<span class="season__meta"><bdi dir="ltr">2035-01-01</bdi></span>');
    expect(html).not.toMatch(/<span class="season__meta" dir="ltr">/);
    expect(html).not.toContain('<form');
  });

  it('labels an open season as active day and the number', () => {
    const html = render({
      kind: 'ready',
      role: 'member',
      status: 'idle',
      values: VALUES,
      seasons: [{ ...season, state: { phase: 'active', dayIndex: 5, open: true } }],
    });
    expect(html).toContain(`${en['season.state.active']} 5`);
    expect(html).toContain('Active, day 5');
  });

  it('created but the list failed: a different alert, no empty line, and Create is disabled', () => {
    const html = render({
      kind: 'ready',
      role: 'admin',
      status: 'list-error',
      values: VALUES,
      seasons: [],
    });
    expect(html).toContain(en['season.error.created']);
    expect(html).not.toContain(en['season.error.save']);
    expect(html).not.toContain(en['season.empty']);
    expect(html).toContain(en['season.retry']);
    expect(html).toMatch(/<button type="submit"[^>]*disabled=""[^>]*>/);
  });

  it.each(['member', 'scholar-reviewer', 'editor'] as const)(
    'hides the create form for a %s',
    (role) => {
      const html = render({ kind: 'ready', role, status: 'idle', values: VALUES, seasons: [] });
      expect(html).not.toContain('<form');
      expect(html).toContain(en['season.empty']);
    },
  );

  it.each(['admin', 'owner'] as const)('shows the create form for a %s', (role) => {
    const html = render({ kind: 'ready', role, status: 'idle', values: VALUES, seasons: [season] });
    expect(html).toContain('<form');
    expect(html).toContain(en['season.name']);
    expect(html).toContain(en['season.create']);
    expect(html).toMatch(/<button type="button"[^>]*>/);
    expect(html).toContain(en['season.suggest']);
    expect(html).not.toContain('type="submit" disabled');
  });

  it('applying a suggestion fills start date and length without submitting', () => {
    const next = applyRamadanSuggestion(VALUES, { startDate: '2026-02-18', lengthDays: 30 });
    expect(next.startDate).toBe('2026-02-18');
    expect(next.lengthDays).toBe('30');
    expect(next.name).toBe(VALUES.name);
    expect(next.kind).toBe(VALUES.kind);
    expect(next.timezone).toBe(VALUES.timezone);
    expect(next.opensAtLocal).toBe(VALUES.opensAtLocal);
    expect(next.closesAtLocal).toBe(VALUES.closesAtLocal);

    const html = render({
      kind: 'ready',
      role: 'admin',
      status: 'idle',
      values: VALUES,
      seasons: [],
    });
    expect(html).toMatch(/<button type="button"[^>]*>Suggest Hijri start<\/button>/);
    expect(html).not.toMatch(/<button type="submit"[^>]*>Suggest Hijri start<\/button>/);
  });
});
