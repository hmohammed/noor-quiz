import { useEffect, useRef } from 'react';
import type { CommunityRole, MemberView } from '@noor/contracts';
import { t } from '../../i18n/t';
import { assignableRoles, canRemoveMember } from './member-access';

export type MemberSaveError = 'last-owner' | 'save' | null;

export type MembersViewState =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'unavailable' }
  | { kind: 'error' }
  | { kind: 'forbidden' }
  | {
      kind: 'ready';
      actorUserId: string;
      actorRole: CommunityRole;
      members: readonly MemberView[];
      drafts: Readonly<Record<string, CommunityRole>>;
      savingUserId: string | null;
      saveError: MemberSaveError;
      confirmRemoveUserId: string | null;
      removing: boolean;
      removeError: boolean;
    };

export interface MembersViewProps {
  state: MembersViewState;
  onSignIn?(): void;
  onRetry?(): void;
  onDraftChange?(userId: string, role: CommunityRole): void;
  onSave?(userId: string): void;
  onRemoveStart?(userId: string): void;
  onRemove?(userId: string): void;
  onRemoveCancel?(): void;
}

export function MembersView({
  state,
  onSignIn,
  onRetry,
  onDraftChange,
  onSave,
  onRemoveStart,
  onRemove,
  onRemoveCancel,
}: MembersViewProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirming = state.kind === 'ready' ? state.confirmRemoveUserId : null;

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  const title = <h1 className="members__title">{t('members.title')}</h1>;

  switch (state.kind) {
    case 'loading':
      return (
        <main className="page">
          {title}
          <p role="status" aria-busy="true" className="members__status">
            {t('members.loading')}
          </p>
        </main>
      );
    case 'signed-out':
      return (
        <main className="page">
          {title}
          <p className="members__status">{t('members.signedOut')}</p>
          <button type="button" className="auth__button" onClick={onSignIn}>
            {t('auth.signIn')}
          </button>
        </main>
      );
    case 'unavailable':
      return (
        <main className="page">
          {title}
          <p className="members__status">{t('members.unavailable')}</p>
        </main>
      );
    case 'error':
      return (
        <main className="page">
          {title}
          <p role="alert" className="members__error">
            {t('members.error.load')}
          </p>
          <button type="button" className="auth__button" onClick={onRetry}>
            {t('members.retry')}
          </button>
        </main>
      );
    case 'forbidden':
      return (
        <main className="page">
          {title}
          <p role="alert" className="members__error">
            {t('members.forbidden')}
          </p>
        </main>
      );
    case 'ready':
      break;
  }

  const { actorUserId, actorRole, members, drafts, savingUserId, saveError, confirmRemoveUserId } =
    state;
  const actor = { userId: actorUserId, role: actorRole };

  return (
    <main className="page">
      {title}
      {saveError === 'last-owner' && (
        <p role="alert" className="members__error">
          {t('members.error.lastOwner')}
        </p>
      )}
      {saveError === 'save' && (
        <p role="alert" className="members__error">
          {t('members.error.save')}
        </p>
      )}
      {state.removeError && (
        <p role="alert" className="members__error">
          {t('members.error.remove')}
        </p>
      )}
      {members.length === 0 ? (
        <p className="members__status">{t('members.empty')}</p>
      ) : (
        <ul className="members__list">
          {members.map((member) => {
            const self = member.userId === actorUserId;
            const options = self ? [] : assignableRoles(actor, member);
            const selected = drafts[member.userId] ?? member.role;
            const saving = savingUserId === member.userId;
            const removable = !self && canRemoveMember(actor, member);
            const confirmingThis = confirmRemoveUserId === member.userId;
            const selectId = `member-role-${member.userId}`;
            return (
              <li key={member.userId} className="members__item" data-user={member.userId}>
                <span className="members__name" dir="auto">
                  {member.displayName ?? t('members.unnamed')}
                </span>
                <span className="members__role">{t(`community.role.${member.role}`)}</span>
                {options.length > 0 && (
                  <div className="members__field">
                    <label htmlFor={selectId}>{t('members.role')}</label>
                    <select
                      id={selectId}
                      className="members__control"
                      value={selected}
                      disabled={saving || undefined}
                      onChange={(e) =>
                        onDraftChange?.(member.userId, e.target.value as CommunityRole)
                      }
                    >
                      {options.map((role) => (
                        <option key={role} value={role}>
                          {t(`community.role.${role}`)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="auth__button"
                      disabled={saving || undefined}
                      onClick={() => onSave?.(member.userId)}
                    >
                      {saving ? t('members.saving') : t('members.save')}
                    </button>
                  </div>
                )}
                {removable && !confirmingThis && (
                  <button
                    type="button"
                    className="auth__button members__remove"
                    onClick={() => onRemoveStart?.(member.userId)}
                  >
                    {t('members.remove')}
                  </button>
                )}
                {removable && confirmingThis && (
                  <div className="members__confirm" aria-busy={state.removing ? true : undefined}>
                    <p>{t('members.remove.confirmPrompt')}</p>
                    <div className="members__actions">
                      <button
                        type="button"
                        className="members__confirm-button"
                        disabled={state.removing || undefined}
                        onClick={() => onRemove?.(member.userId)}
                      >
                        {state.removing ? t('members.saving') : t('members.remove.confirm')}
                      </button>
                      <button
                        type="button"
                        className="members__cancel"
                        ref={cancelRef}
                        disabled={state.removing || undefined}
                        onClick={onRemoveCancel}
                      >
                        {t('members.remove.cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
