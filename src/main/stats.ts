import { join } from 'path'
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'

// Persistencia ligera de uso: cuántas pausas se tomaron / saltaron / pospusieron por día.
// Vive en un JSON aparte de settings para no mezclar configuración con historial.

interface DayStat {
  completed: number
  skipped: number
  snoozed: number
}
interface StatsData {
  days: Record<string, DayStat> // clave 'YYYY-MM-DD'
}

function statsPath(): string {
  return join(app.getPath('userData'), 'stats.json')
}

function load(): StatsData {
  try {
    if (existsSync(statsPath())) {
      const parsed = JSON.parse(readFileSync(statsPath(), 'utf8'))
      return { days: parsed.days ?? {} }
    }
  } catch {
    /* arranca vacío */
  }
  return { days: {} }
}

let data = load()

function save(): void {
  try {
    writeFileSync(statsPath(), JSON.stringify(data, null, 2))
  } catch {
    /* sin persistencia no es crítico */
  }
}

function dayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function ensureDay(key: string): DayStat {
  if (!data.days[key]) data.days[key] = { completed: 0, skipped: 0, snoozed: 0 }
  return data.days[key]
}

export function recordCompleted(): void {
  ensureDay(dayKey()).completed++
  save()
}
export function recordSkipped(): void {
  ensureDay(dayKey()).skipped++
  save()
}
export function recordSnoozed(): void {
  ensureDay(dayKey()).snoozed++
  save()
}

export function todayStat(): DayStat {
  return data.days[dayKey()] ?? { completed: 0, skipped: 0, snoozed: 0 }
}

/** Días consecutivos (terminando hoy, o ayer si hoy aún no hay pausas) con ≥1 pausa completada. */
export function currentStreak(): number {
  let streak = 0
  const cursor = new Date()
  if ((data.days[dayKey(cursor)]?.completed ?? 0) === 0) {
    cursor.setDate(cursor.getDate() - 1) // hoy todavía sin pausas → cuenta desde ayer
  }
  while ((data.days[dayKey(cursor)]?.completed ?? 0) > 0) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export interface StatsSummary {
  today: DayStat
  streak: number
  totalCompleted: number
  last7: { label: string; completed: number; skipped: number }[]
}

export function summary(): StatsSummary {
  const dayNames = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  const last7: StatsSummary['last7'] = []
  const cursor = new Date()
  cursor.setDate(cursor.getDate() - 6)
  for (let i = 0; i < 7; i++) {
    const s = data.days[dayKey(cursor)] ?? { completed: 0, skipped: 0, snoozed: 0 }
    last7.push({ label: dayNames[cursor.getDay()], completed: s.completed, skipped: s.skipped })
    cursor.setDate(cursor.getDate() + 1)
  }
  const totalCompleted = Object.values(data.days).reduce((acc, d) => acc + d.completed, 0)
  return { today: todayStat(), streak: currentStreak(), totalCompleted, last7 }
}
