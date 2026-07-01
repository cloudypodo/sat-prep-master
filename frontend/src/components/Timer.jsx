import React from 'react';

export default function Timer({ formatted, isLow, isCritical, running }) {
  return (
    <div style={{
      ...styles.timer,
      background: isCritical ? 'var(--error-light)' : isLow ? 'var(--warning-light)' : 'var(--primary-light)',
      color: isCritical ? 'var(--error)' : isLow ? 'var(--warning)' : 'var(--primary)',
      borderColor: isCritical ? '#fca5a5' : isLow ? '#fde68a' : '#bfdbfe',
      animation: isCritical ? 'pulse 1s ease infinite' : 'none',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span style={styles.time}>{formatted}</span>
      {!running && <span style={styles.paused}>Paused</span>}
    </div>
  );
}

const styles = {
  timer: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.375rem 0.875rem',
    borderRadius: 999,
    border: '1.5px solid',
    fontWeight: 600,
    fontSize: '0.9375rem',
    transition: 'all 0.3s',
    userSelect: 'none',
  },
  time: {
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.05em',
    minWidth: '3.5rem',
    textAlign: 'center',
  },
  paused: {
    fontSize: '0.75rem',
    fontWeight: 600,
    opacity: 0.7,
  },
};
