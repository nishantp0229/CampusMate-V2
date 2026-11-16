import { MessageCircle, Search, UserPlus } from 'lucide-react'
import { communityFriendRelationship } from '../lib/community'

export default function CommunityFriends({
  search, onSearch, searchResults, searchLoading, searchError, fieldClass,
  friends, requests, blocked, loading, error, actionError, busy, onRefresh,
  onRequest, onRespond, onCancel, onUnfriend, onMessage, onUnblock,
}) {
  const incoming = requests.filter((request) => request.direction === 'incoming')
  const outgoing = requests.filter((request) => request.direction === 'outgoing')
  const actionsDisabled = busy || loading || Boolean(error)

  return (
    <div className="mt-6 space-y-5">
      <section aria-label="Find friends">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--cm-muted)]">Find friends</p>
          <UserPlus size={14} className="text-[var(--cm-accent)]" />
        </div>
        <div className="relative mt-3">
          <Search size={14} className="absolute left-3 top-2.5 text-[var(--cm-muted)]" />
          <input value={search} onChange={(event) => onSearch(event.target.value)}
            placeholder="Search students" aria-label="Search students by display name" className={`${fieldClass} pl-8 text-xs`} />
        </div>
        {search.trim().length >= 2 && (
          <div className="mt-2 border border-[var(--cm-border)] bg-[var(--cm-surface)] p-2">
            {searchLoading ? <p className="p-2 text-xs text-[var(--cm-muted)]">Searching...</p>
              : searchError ? <p role="alert" className="p-2 text-xs text-rose-600">{searchError}</p>
                : searchResults.length === 0 ? <p className="p-2 text-xs text-[var(--cm-muted)]">No students found.</p>
                  : searchResults.map((student) => {
                    const relationship = communityFriendRelationship(student.user_id, friends, requests, blocked)
                    const label = { blocked: 'Unblock', friend: 'Message', incoming: 'Respond below', outgoing: 'Requested', none: 'Add friend' }[relationship]
                    return (
                      <button key={student.user_id} type="button"
                        disabled={actionsDisabled || relationship === 'incoming' || relationship === 'outgoing'}
                        onClick={() => relationship === 'blocked' ? onUnblock(student.user_id) : relationship === 'friend'
                          ? onMessage(student.user_id) : onRequest(student.user_id)}
                        className="flex w-full justify-between gap-2 p-2 text-left text-xs text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] disabled:opacity-60">
                        <span className="truncate">{student.display_name}</span>
                        <span className="shrink-0 font-bold text-[var(--cm-accent)]">{label}</span>
                      </button>
                    )
                  })}
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}{' '}<button type="button" onClick={onRefresh} className="font-bold underline">Retry</button>
        </p>
      )}
      {actionError && <p role="alert" className="text-xs text-rose-600">{actionError}</p>}

      <section aria-label="Friend requests">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--cm-muted)]">Friend requests</p>
          {incoming.length > 0 && <span aria-label={`${incoming.length} incoming friend requests`} className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">{incoming.length}</span>}
        </div>
        {loading && requests.length === 0 ? <p className="mt-2 text-xs text-[var(--cm-muted)]">Loading requests...</p>
          : requests.length === 0 && !error ? <p className="mt-2 text-xs text-[var(--cm-muted)]">No pending requests.</p> : null}
        {incoming.map((request) => (
          <div key={request.id} className="mt-3 space-y-1 border-b border-[var(--cm-border)] pb-2 text-xs">
            <p className="truncate font-bold text-[var(--cm-text)]">{request.peerName}</p>
            <p className="text-[10px] text-[var(--cm-muted)]">Incoming request</p>
            <div className="flex gap-3">
              <button type="button" disabled={actionsDisabled} onClick={() => onRespond(request.id, true)}
                aria-label={`Accept friend request from ${request.peerName}`} className="font-bold text-[var(--cm-accent)] disabled:opacity-50">Accept</button>
              <button type="button" disabled={actionsDisabled} onClick={() => onRespond(request.id, false)}
                aria-label={`Reject friend request from ${request.peerName}`} className="font-bold text-[var(--cm-muted)] disabled:opacity-50">Reject</button>
            </div>
          </div>
        ))}
        {outgoing.map((request) => (
          <div key={request.id} className="mt-3 flex items-center justify-between gap-2 border-b border-[var(--cm-border)] pb-2 text-xs">
            <span className="min-w-0"><strong className="block truncate text-[var(--cm-text)]">{request.peerName}</strong><span className="text-[10px] text-[var(--cm-muted)]">Request sent</span></span>
            <button type="button" disabled={actionsDisabled} onClick={() => onCancel(request.id)}
              aria-label={`Cancel friend request to ${request.peerName}`} className="font-bold text-[var(--cm-muted)] disabled:opacity-50">Cancel</button>
          </div>
        ))}
      </section>

      <section aria-label="Friends list">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--cm-muted)]">Friends ({friends.length})</p>
        {loading && friends.length === 0 ? <p className="mt-2 text-xs text-[var(--cm-muted)]">Loading friends...</p>
          : friends.length === 0 && !error ? <p className="mt-2 text-xs text-[var(--cm-muted)]">No friends yet.</p> : null}
        {friends.map((friend) => (
          <div key={friend.id} className="mt-3 space-y-1 border-b border-[var(--cm-border)] pb-2 text-xs">
            <p className="truncate font-bold text-[var(--cm-text)]">{friend.name}</p>
            <div className="flex gap-3">
              <button type="button" disabled={actionsDisabled || !friend.available} onClick={() => onMessage(friend.id)}
                aria-label={`Message ${friend.name}`} className="inline-flex items-center gap-1 font-bold text-[var(--cm-accent)] disabled:opacity-50"><MessageCircle size={12} /> Message</button>
              <button type="button" disabled={actionsDisabled} onClick={() => onUnfriend(friend.id, friend.name)}
                aria-label={`Unfriend ${friend.name}`} className="font-bold text-[var(--cm-muted)] disabled:opacity-50">Unfriend</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
