import { useEffect, useState } from 'react'

interface StatsSummary {
  today: { completed: number; skipped: number; snoozed: number }
  streak: number
  totalCompleted: number
  last7: { label: string; completed: number; skipped: number }[]
}

declare global {
  interface Window {
    statsAPI: { get: () => Promise<StatsSummary> }
  }
}

export default function Stats(): JSX.Element {
  const [data, setData] = useState<StatsSummary | null>(null)

  useEffect(() => {
    window.statsAPI.get().then(setData)
  }, [])

  if (!data) {
    return (
      <div className="stats-root">
        <p className="stats-loading">Cargando…</p>
      </div>
    )
  }

  const maxBar = Math.max(1, ...data.last7.map((d) => d.completed))

  return (
    <div className="stats-root">
      <h1 className="stats-title">Tus pausas</h1>

      {/* Tarjetas resumen */}
      <div className="stats-cards">
        <div className="stats-card">
          <span className="stats-num">{data.today.completed}</span>
          <span className="stats-cap">hoy</span>
        </div>
        <div className="stats-card">
          <span className="stats-num">
            {data.streak}
            <span className="stats-fire">{data.streak > 0 ? ' 🔥' : ''}</span>
          </span>
          <span className="stats-cap">racha (días)</span>
        </div>
        <div className="stats-card">
          <span className="stats-num">{data.totalCompleted}</span>
          <span className="stats-cap">total</span>
        </div>
      </div>

      {/* Últimos 7 días */}
      <div className="stats-chart-label">Últimos 7 días</div>
      <div className="stats-chart">
        {data.last7.map((d, i) => (
          <div className="stats-bar-col" key={i}>
            <div className="stats-bar-track">
              <div
                className="stats-bar-fill"
                style={{ height: `${(d.completed / maxBar) * 100}%` }}
                title={`${d.completed} pausa${d.completed === 1 ? '' : 's'}`}
              />
            </div>
            <span className="stats-bar-count">{d.completed || ''}</span>
            <span className="stats-bar-day">{d.label}</span>
          </div>
        ))}
      </div>

      <p className="stats-footer">
        Hoy: {data.today.completed} completadas · {data.today.skipped} saltadas ·{' '}
        {data.today.snoozed} pospuestas
      </p>
    </div>
  )
}
