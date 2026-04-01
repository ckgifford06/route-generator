import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import styles from './ElevationChart.module.css'

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { distance_miles, elevation_ft } = payload[0].payload
  return (
    <div className={styles.tooltip}>
      <span>{distance_miles.toFixed(2)} mi</span>
      <span>{elevation_ft.toFixed(0)} ft</span>
    </div>
  )
}

export default function ElevationChart({ profile }) {
  if (!profile || profile.length === 0) return null

  const minElev = Math.min(...profile.map(p => p.elevation_ft))
  const maxElev = Math.max(...profile.map(p => p.elevation_ft))
  const padding = (maxElev - minElev) * 0.2 || 20

  return (
    <div className={styles.container}>
      <span className={styles.label}>Elevation</span>
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={profile} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#c8f060" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#c8f060" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="distance_miles"
            tickFormatter={(v) => `${v.toFixed(1)}mi`}
            tick={{ fill: '#888880', fontSize: 10, fontFamily: 'DM Mono' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minElev - padding, maxElev + padding]}
            tickFormatter={(v) => `${Math.round(v)}ft`}
            tick={{ fill: '#888880', fontSize: 10, fontFamily: 'DM Mono' }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="elevation_ft"
            stroke="#c8f060"
            strokeWidth={1.5}
            fill="url(#elevGradient)"
            dot={false}
            activeDot={{ r: 3, fill: '#c8f060', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
