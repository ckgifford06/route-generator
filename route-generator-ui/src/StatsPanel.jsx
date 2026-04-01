import styles from './StatsPanel.module.css'

export default function StatsPanel({ data, onDownloadGpx }) {
  return (
    <div className={styles.panel}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.value}>{data.distance_miles}</span>
          <span className={styles.label}>miles</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.stat}>
          <span className={styles.value}>{data.elevation_gain_ft}</span>
          <span className={styles.label}>ft gain</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.stat}>
          <span className={styles.value}>{data.constraints.route_type}</span>
          <span className={styles.label}>type</span>
        </div>
      </div>
      <button className={styles.download} onClick={onDownloadGpx}>
        <DownloadIcon />
        Download GPX
      </button>
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}