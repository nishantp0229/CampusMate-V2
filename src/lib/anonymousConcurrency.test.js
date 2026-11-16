// An in-memory model of the intended ordering, NOT a PostgreSQL concurrency test.
import test from 'node:test'
import assert from 'node:assert/strict'

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

class MatchModel {
  constructor() {
    this.tail = Promise.resolve()
    this.participants = new Map()
    this.rooms = new Map()
    this.blocks = new Set()
    this.queue = new Set()
    this.reports = []
    this.evidence = ['preserved message']
  }

  async locked(operation, barrier) {
    const previous = this.tail
    let release
    this.tail = new Promise((done) => { release = done })
    await previous
    try {
      if (barrier) {
        barrier.entered.resolve()
        await barrier.release.promise
      }
      return await operation()
    } finally {
      release()
    }
  }

  pair(a, b) { return [a, b].sort().join(':') }

  join(a, b, barrier) {
    return this.locked(() => {
      if (this.blocks.has(this.pair(a, b)) || this.participants.has(a) || this.participants.has(b)) return null
      const id = `room-${this.rooms.size + 1}`
      this.rooms.set(id, { a, b, active: true })
      this.participants.set(a, id)
      this.participants.set(b, id)
      return id
    }, barrier)
  }

  blockOrReport(a, b, kind, barrier) {
    return this.locked(() => {
      this.blocks.add(this.pair(a, b))
      if (kind === 'report') this.reports.push({ a, b, status: 'pending' })
      for (const room of this.rooms.values()) {
        if (room.active && this.pair(room.a, room.b) === this.pair(a, b)) {
          room.active = false
          this.participants.delete(room.a)
          this.participants.delete(room.b)
        }
      }
    }, barrier)
  }

  leaveRoom(user, id) {
    return this.locked(() => {
      const room = this.rooms.get(id)
      if (room?.active && (room.a === user || room.b === user)) {
        room.active = false
        this.participants.delete(room.a)
        this.participants.delete(room.b)
      }
    })
  }
}

test('[mock model] block and report racing a rematch leave no active blocked pair', async () => {
  for (const kind of ['block', 'report']) {
    for (const joinFirst of [true, false]) {
      const model = new MatchModel()
      const barrier = { entered: deferred(), release: deferred() }
      const first = joinFirst
        ? model.join('A', 'B', barrier)
        : model.blockOrReport('A', 'B', kind, barrier)
      await barrier.entered.promise
      const second = joinFirst ? model.blockOrReport('A', 'B', kind) : model.join('A', 'B')
      barrier.release.resolve()
      await Promise.all([first, second])
      assert.equal([...model.rooms.values()].some((room) => room.active), false, `${kind}, joinFirst=${joinFirst}`)
      assert.equal(model.participants.size, 0)
      assert.deepEqual(model.evidence, ['preserved message'])
      assert.equal(model.reports.length, kind === 'report' ? 1 : 0)
    }
  }
})

test('[mock model] simultaneous opposite-position joins cannot put one user in two rooms', async () => {
  const model = new MatchModel()
  const results = await Promise.all([model.join('A', 'B'), model.join('C', 'A')])
  assert.equal(results.filter(Boolean).length, 1)
  assert.equal(model.participants.size, 2)
})

test('[mock model] a delayed leave for an old room does not cancel a newer queue entry', async () => {
  const model = new MatchModel()
  const oldRoom = await model.join('A', 'B')
  await model.leaveRoom('A', oldRoom)
  model.queue.add('A')
  await model.leaveRoom('A', oldRoom)
  assert.equal(model.queue.has('A'), true)
})
