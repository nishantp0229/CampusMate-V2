export const COMMUNITY_PAGE_SIZE = 40

// UI hints only; the database independently enforces friendship and blocks.
export function communityFriendRelationship(peerId, friends, requests, blocked) {
  if (blocked.some((item) => item.id === peerId)) return 'blocked'
  if (friends.some((item) => item.id === peerId)) return 'friend'
  const request = requests.find((item) => item.peerId === peerId)
  return request?.direction === 'incoming' ? 'incoming' : request ? 'outgoing' : 'none'
}

const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0
const fraction = (value) => (value.match(/\.(\d+)/)?.[1] || '').padEnd(9, '0').slice(0, 9)
const compareTimestamps = (left, right) =>
  Date.parse(left) - Date.parse(right) || compare(fraction(left), fraction(right))

// A message can arrive through both an RPC response and Realtime.
export function mergeCommunityMessages(current, incoming) {
  const messages = new Map(current.map((message) => [message.id, message]))
  for (const message of incoming) {
    const previous = messages.get(message.id)
    const version = (item) => item.deleted_at || item.edited_at || item.created_at
    const difference = previous ? compareTimestamps(version(message), version(previous)) : 1
    if (difference > 0 || (difference === 0 && (!previous.deleted_at || message.deleted_at))) {
      messages.set(message.id, message)
    }
  }
  return [...messages.values()].sort((a, b) => {
    // Date.parse rounds PostgreSQL's microsecond timestamps to milliseconds.
    return compareTimestamps(a.created_at, b.created_at) || compare(a.id.toLowerCase(), b.id.toLowerCase())
  })
}

// Both values come from a previously loaded database row, not user input.
export function communityCursorFilter(message) {
  const timestamp = message?.created_at
  const id = message?.id
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(timestamp || '') ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '')) {
    throw new Error('Invalid message cursor. Refresh the conversation and try again.')
  }
  return `created_at.lt.${timestamp},and(created_at.eq.${timestamp},id.lt.${id})`
}
