// Attendance is compared using the exact counts, not a rounded percentage.
export function attendancePercentage(attended, total) {
  if (!Number.isInteger(attended) || !Number.isInteger(total) ||
      total <= 0 || attended < 0 || attended > total) return null
  return Math.floor((attended * 1000) / total) / 10
}

export function isAttendanceSafe(attended, total) {
  return attendancePercentage(attended, total) !== null && attended * 4 >= total * 3
}
