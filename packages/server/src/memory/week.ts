export function isoWeekKey(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - jan4.getTime()) / 86_400_000 -
        3 +
        ((jan4.getDay() + 6) % 7)) /
        7,
    )
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`
}

export function isoDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function parseIsoDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number)
  return new Date(y!, m! - 1, d!)
}

export function runLabel(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  return `${h}:${m}`
}
