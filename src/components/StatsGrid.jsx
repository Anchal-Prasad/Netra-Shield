import { STAT_CARDS } from '../lib/constants'

const ICONS = {
  total: {
    image: '/iconTP.png',
    color: '#3b82f6',
  },
  attacks: {
    image: '/attacks.png',
    color: '#ef4444',
  },
  benign: {
    image: '/beign.png',
    color: '#10b981',
  },
  unknown: {
    image: '/unknown.png',
    color: '#f59e0b',
  },
}

export default function StatsGrid({ stats, changes }) {
  return (
    <div className="stats-grid">
      {STAT_CARDS.map(({ key, label }) => {
        const { image, color } = ICONS[key]

        const change = changes[key] || 0
        const isPos = change >= 0
        const val = stats[key] ?? 0

        return (
          <div
            key={key}
            className="stat-card"
            data-stat={key}
            style={{
              '--card-accent': color,
              borderColor: `${color}66`,
              boxShadow: `
                  0 0 8px ${color}20,
                  0 0 16px ${color}15,
                  inset 0 0 8px ${color}08
              `
            }}
          >
            <div className="stat-top">
              <div
                className="stat-icon"
                style={{
                  background: `${color}14`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={image}
                  alt={label}
                  style={{
                    width: key === 'total' ? '40px' : '28px',
                    height: key === 'total' ? '40px' : '28px',
                    objectFit: 'contain',
                  }}
                />
              </div>

              {/* <div
                className={`stat-change ${isPos ? 'change-up' : 'change-down'
                  }`}
              >
                {isPos ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
              </div> */}
            </div>

            <div
              className="stat-value mono"
              style={{ color }}
            >
              {val.toLocaleString()}
            </div>

            <div className="stat-label">{label}</div>

            <div
              className="stat-accent-line"
              style={{
                background: `linear-gradient(90deg, ${color}, transparent)`,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}