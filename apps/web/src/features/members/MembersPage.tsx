import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { CommunityRole, MemberView } from '@noor/contracts';
import { ApiError } from '../../api/client';
import { useSession, type Session } from '../auth/session-context';
import { MembersView, type MemberSaveError, type MembersViewState } from './MembersView';

const reloadPage = () => window.location.reload();

/** List a community's members and, for an admin, change roles or remove. Talks to the API only through the session. */
export function MembersPage() {
  const session = useSession();
  const { tenantId = '' } = useParams();
  const { state } = session;

  if (state.kind === 'signed-in') {
    return (
      <MembersEditor
        key={`${state.me.userId}:${tenantId}`}
        actorUserId={state.me.userId}
        tenantId={tenantId}
        listMyCommunities={session.listMyCommunities}
        listMembers={session.listMembers}
        changeMemberRole={session.changeMemberRole}
        removeMember={session.removeMember}
      />
    );
  }

  const viewState: MembersViewState =
    state.kind === 'loading'
      ? { kind: 'loading' }
      : state.kind === 'error'
        ? { kind: 'error' }
        : state.kind === 'unavailable'
          ? { kind: 'unavailable' }
          : { kind: 'signed-out' };

  return <MembersView state={viewState} onSignIn={session.signIn} onRetry={reloadPage} />;
}

function MembersEditor({
  actorUserId,
  tenantId,
  listMyCommunities,
  listMembers,
  changeMemberRole,
  removeMember,
}: {
  actorUserId: string;
  tenantId: string;
  listMyCommunities: Session['listMyCommunities'];
  listMembers: Session['listMembers'];
  changeMemberRole: Session['changeMemberRole'];
  removeMember: Session['removeMember'];
}) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'forbidden' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [actorRole, setActorRole] = useState<CommunityRole>('member');
  const [members, setMembers] = useState<readonly MemberView[]>([]);
  const [drafts, setDrafts] = useState<Record<string, CommunityRole>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<MemberSaveError>(null);
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listMyCommunities()
      .then(async (mine) => {
        const community = mine.communities.find((item) => item.tenantId === tenantId);
        if (!community) throw new Error('missing community');
        const listed = await listMembers(tenantId);
        return { community, members: listed.members };
      })
      .then(
        (loaded) => {
          if (cancelled) return;
          setActorRole(loaded.community.role);
          setMembers(loaded.members);
          setDrafts({});
          setSaveError(null);
          setConfirmRemoveUserId(null);
          setRemoveError(false);
          setPhase('ready');
        },
        (err) => {
          if (cancelled) return;
          if (err instanceof ApiError && err.status === 403) {
            setPhase('forbidden');
            return;
          }
          setPhase('error');
        },
      );
    return () => {
      cancelled = true;
    };
  }, [listMyCommunities, listMembers, tenantId, attempt]);

  if (phase === 'loading') {
    return <MembersView state={{ kind: 'loading' }} />;
  }
  if (phase === 'forbidden') {
    return <MembersView state={{ kind: 'forbidden' }} />;
  }
  if (phase === 'error') {
    return (
      <MembersView
        state={{ kind: 'error' }}
        onRetry={() => {
          setPhase('loading');
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  const refreshList = () =>
    listMembers(tenantId).then(
      (res) => {
        setMembers(res.members);
        setDrafts({});
        setSaveError(null);
        setConfirmRemoveUserId(null);
        setRemoveError(false);
      },
      (err) => {
        if (err instanceof ApiError && err.status === 403) {
          setPhase('forbidden');
          return;
        }
        setPhase('error');
      },
    );

  return (
    <MembersView
      state={{
        kind: 'ready',
        actorUserId,
        actorRole,
        members,
        drafts,
        savingUserId,
        saveError,
        confirmRemoveUserId,
        removing,
        removeError,
      }}
      onDraftChange={(userId, role) => {
        setDrafts((current) => ({ ...current, [userId]: role }));
        setSaveError(null);
      }}
      onSave={(userId) => {
        if (savingUserId !== null || removing) return;
        const role = drafts[userId] ?? members.find((m) => m.userId === userId)?.role;
        if (!role) return;
        setSavingUserId(userId);
        setSaveError(null);
        changeMemberRole(tenantId, userId, { role }).then(
          () => {
            setSavingUserId(null);
            void refreshList();
          },
          (err) => {
            setSavingUserId(null);
            setSaveError(err instanceof ApiError && err.status === 409 ? 'last-owner' : 'save');
          },
        );
      }}
      onRemoveStart={(userId) => {
        if (savingUserId !== null || removing) return;
        setConfirmRemoveUserId(userId);
        setRemoveError(false);
        setSaveError(null);
      }}
      onRemoveCancel={() => {
        if (removing) return;
        setConfirmRemoveUserId(null);
        setRemoveError(false);
      }}
      onRemove={(userId) => {
        if (removing || savingUserId !== null) return;
        setRemoving(true);
        setRemoveError(false);
        removeMember(tenantId, userId).then(
          () => {
            setRemoving(false);
            setConfirmRemoveUserId(null);
            void refreshList();
          },
          () => {
            setRemoving(false);
            setRemoveError(true);
          },
        );
      }}
    />
  );
}
