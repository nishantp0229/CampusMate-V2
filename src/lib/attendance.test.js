import test from 'node:test'
import assert from 'node:assert/strict'
import { attendancePercentage, isAttendanceSafe } from './attendance.js'

test('attendance uses exact counts for the 75% threshold', () => {
  assert.equal(attendancePercentage(3, 4), 75)
  assert.equal(isAttendanceSafe(3, 4), true)
  assert.equal(attendancePercentage(149, 200), 74.5)
  assert.equal(isAttendanceSafe(149, 200), false)
})

test('display percentages do not round a shortage up', () => {
  assert.equal(attendancePercentage(1, 3), 33.3)
  assert.equal(attendancePercentage(2, 3), 66.6)
  assert.equal(attendancePercentage(4, 4), 100)
})

test('missing or invalid class counts are not treated as attendance', () => {
  for (const [attended, total] of [[0, 0], [5, 4], [-1, 4], [1.5, 4]]) {
    assert.equal(attendancePercentage(attended, total), null)
    assert.equal(isAttendanceSafe(attended, total), false)
  }
})
