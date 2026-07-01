import React from 'react';

export default function ProgressBar({ current, total, label }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div style={styles.wrap}>
      {label && <span style={styles.label}>{label}</span>}
      <div style={styles.track}>
        <div style={{ ...styles.fill, width: `${pct}%` }} />
      </div>
      <span style={styles.count}>{current}/{total}</span>
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  label: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    fontWeight: 500,
    flexShrink: 0,
  },
  track: {
    flex: 1,
    height: 6,
    background: 'var(--border)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    background: 'var(--primary)',
    borderRadius: 999,
    transition: 'width 0.3s ease',
  },
  count: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    fontWeight: 500,
    flexShrink: 0,
    minWidth: '2.5rem',
    textAlign: 'right',
  },
};
