import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const isActive = (path) => location.pathname === path;

  return (
    <nav style={styles.nav}>
      <div style={styles.inner}>
        <Link to="/" style={styles.logo}>
          <span style={styles.logoIcon}>S</span>
          <span>SAT Prep Master</span>
        </Link>

        <div style={styles.links}>
          <Link to="/" style={{ ...styles.link, ...(isActive('/') ? styles.linkActive : {}) }}>Dashboard</Link>
          <Link to="/test/setup" style={{ ...styles.link, ...(isActive('/test/setup') ? styles.linkActive : {}) }}>New Test</Link>
        </div>

        <div style={styles.userArea}>
          <span style={styles.userName}>{user?.name}</span>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ fontSize: '0.875rem', padding: '0.4rem 0.85rem' }}>
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: 'var(--shadow-sm)',
  },
  inner: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '0 1.5rem',
    height: 60,
    display: 'flex',
    alignItems: 'center',
    gap: '2rem',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontWeight: 700,
    fontSize: '1.1rem',
    color: 'var(--text)',
    textDecoration: 'none',
    flexShrink: 0,
  },
  logoIcon: {
    background: 'var(--primary)',
    color: '#fff',
    width: 28,
    height: 28,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '0.9rem',
  },
  links: {
    display: 'flex',
    gap: '0.25rem',
    flex: 1,
  },
  link: {
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    padding: '0.4rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9375rem',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  linkActive: {
    color: 'var(--primary)',
    background: 'var(--primary-light)',
  },
  userArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexShrink: 0,
  },
  userName: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
};
