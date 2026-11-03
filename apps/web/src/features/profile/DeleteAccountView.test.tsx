import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../../i18n/en.json';
import { DeleteAccountView, type DeleteAccountStatus } from './DeleteAccountView';

const noop = () => undefined;

const render = (status: DeleteAccountStatus) =>
  renderToStaticMarkup(
    <DeleteAccountView status={status} onStart={noop} onConfirm={noop} onCancel={noop} />,
  );

const text = (key: keyof typeof en) => en[key].replace(/'/g, '&#x27;');

describe('DeleteAccountView', () => {
  it('idle: title, intro and a start button, and no form', () => {
    const html = render('idle');
    expect(html).toMatch(new RegExp(`<h2[^>]*>${text('profile.delete.title')}</h2>`));
    expect(html).toContain(text('profile.delete.intro'));
    expect(html).toMatch(
      new RegExp(`<button type="button"[^>]*>${text('profile.delete.start')}</button>`),
    );
    expect(html).not.toContain('<form');
    expect(html).not.toContain('profile.delete.');
  });

  it('confirming: warning text and confirm and cancel buttons', () => {
    const html = render('confirming');
    expect(html).toContain(text('profile.delete.confirmPrompt'));
    expect(html).toMatch(
      new RegExp(`<button type="button"[^>]*>${text('profile.delete.confirm')}</button>`),
    );
    expect(html).toMatch(
      new RegExp(`<button type="button"[^>]*>${text('profile.delete.cancel')}</button>`),
    );
    expect(html).not.toContain('disabled');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('profile.delete.');
  });

  it('deleting: both buttons are disabled, the confirm label changes, and the section is busy', () => {
    const html = render('deleting');
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(
      new RegExp(
        `<button type="button"[^>]*disabled=""[^>]*>${text('profile.delete.deleting')}</button>`,
      ),
    );
    expect(html).toMatch(
      new RegExp(
        `<button type="button"[^>]*disabled=""[^>]*>${text('profile.delete.cancel')}</button>`,
      ),
    );
    expect(html).not.toContain('profile.delete.');
  });

  it('error: an alert, and the confirm and cancel buttons are enabled again', () => {
    const html = render('error');
    expect(html).toMatch(new RegExp(`<p role="alert"[^>]*>${text('profile.delete.error')}</p>`));
    expect(html).toMatch(
      new RegExp(`<button type="button"[^>]*>${text('profile.delete.confirm')}</button>`),
    );
    expect(html).toMatch(
      new RegExp(`<button type="button"[^>]*>${text('profile.delete.cancel')}</button>`),
    );
    expect(html).not.toContain('disabled');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('profile.delete.');
  });
});
