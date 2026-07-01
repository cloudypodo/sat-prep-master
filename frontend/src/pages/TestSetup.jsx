import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import api from '../api/client.js';

const RW_TOPICS = [
  'Central Ideas & Details', 'Command of Evidence', 'Inferences',
  'Words in Context', 'Text Structure & Purpose', 'Cross-Text Connections',
  'Rhetorical Synthesis', 'Transitions',
  'Boundaries', 'Form, Structure, & Sense',
];

const MATH_TOPICS = [
  'Linear Equations (One Variable)', 'Linear Equations (Two Variables)', 'Linear Functions',
  'Systems of Linear Equations', 'Linear Inequalities',
  'Equivalent Expressions', 'Nonlinear Equations', 'Nonlinear Functions',
  'Ratios, Rates & Proportions', 'Percentages', 'One-Variable Data',
  'Two-Variable Data', 'Probability', 'Inference & Statistics',
  'Area & Volume', 'Lines, Angles & Triangles', 'Right Triangles & Trigonometry', 'Circles',
];

export default function TestSetup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'custom' ? 'custom_practice' : 'full_test');
  const [section, setSection] = useState('rw');
  const [difficulty, setDifficulty] = useState('medium');
  const [count, setCount] = useState(10);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const topics = section === 'rw' ? RW_TOPICS : MATH_TOPICS;

  const toggleTopic = (t) => {
    setSelectedTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleStart = async () => {
    setError('');
    setLoading(true);
    try {
      const payload = {
        mode,
        section: mode === 'full_test' ? 'both' : section,
        difficulty,
        count: mode === 'custom_practice' ? count : undefined,
        topics: selectedTopics.length > 0 ? selectedTopics : undefined,
      };
      const { data } = await api.post('/tests', payload);
      navigate(`/test/${data.testId}`, { state: { questions: data.questions, mode, section: payload.section, moduleSpecs: data.moduleSpecs } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div style={styles.page}>
        <h1 className="page-title" style={{ marginBottom: '0.375rem' }}>Set Up Your Practice</h1>
        <p className="text-secondary" style={{ marginBottom: '2rem' }}>
          Configure your test session. Questions are AI-generated fresh every time.
        </p>

        {/* Mode */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h2 className="section-title">Test Mode</h2>
          <div style={styles.modeGrid}>
            <ModeCard
              selected={mode === 'full_test'}
              onClick={() => setMode('full_test')}
              icon="📋"
              title="Full Adaptive Test"
              desc="Both sections, real timing, adaptive Module 2 difficulty based on your Module 1 performance."
              meta="~218 min · 98 questions"
            />
            <ModeCard
              selected={mode === 'custom_practice'}
              onClick={() => setMode('custom_practice')}
              icon="🎯"
              title="Custom Practice"
              desc="Choose your section, topics, difficulty, and number of questions. Untimed."
              meta="Flexible · Your choice"
            />
          </div>
        </div>

        {/* Custom options */}
        {mode === 'custom_practice' && (
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h2 className="section-title">Practice Options</h2>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label className="label">Section</label>
                <select value={section} onChange={e => { setSection(e.target.value); setSelectedTopics([]); }}>
                  <option value="rw">Reading & Writing</option>
                  <option value="math">Math</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label className="label">Difficulty</label>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                  <option value="easy">Easy (real SAT medium)</option>
                  <option value="medium">Medium (real SAT hard)</option>
                  <option value="hard">Hard (real SAT hardest)</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label className="label">Number of Questions</label>
                <select value={count} onChange={e => setCount(Number(e.target.value))}>
                  {[5, 10, 15, 20, 27].map(n => <option key={n} value={n}>{n} questions</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Topics <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional — leave empty for all)</span></label>
              <div style={styles.topicGrid}>
                {topics.map(t => (
                  <button
                    key={t}
                    className={`btn ${selectedTopics.includes(t) ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => toggleTopic(t)}
                    style={{ fontSize: '0.8125rem', padding: '0.4rem 0.75rem' }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Info card for full test */}
        {mode === 'full_test' && (
          <div className="card" style={{ marginBottom: '1.25rem', background: 'var(--primary-light)', border: '1px solid #bfdbfe' }}>
            <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', color: 'var(--primary)' }}>Full Test Structure</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div style={styles.moduleInfo}>
                <div style={styles.moduleTitle}>Reading & Writing — Module 1</div>
                <div style={styles.moduleMeta}>27 questions · 32 minutes</div>
              </div>
              <div style={styles.moduleInfo}>
                <div style={styles.moduleTitle}>Reading & Writing — Module 2</div>
                <div style={styles.moduleMeta}>27 questions · 32 min · Adaptive difficulty</div>
              </div>
              <div style={styles.moduleInfo}>
                <div style={styles.moduleTitle}>Math — Module 1</div>
                <div style={styles.moduleMeta}>22 questions · 35 minutes</div>
              </div>
              <div style={styles.moduleInfo}>
                <div style={styles.moduleTitle}>Math — Module 2</div>
                <div style={styles.moduleMeta}>22 questions · 35 min · Adaptive difficulty</div>
              </div>
            </div>
            <p style={{ marginTop: '0.875rem', fontSize: '0.85rem', color: 'var(--primary)' }}>
              ⚡ Questions are slightly harder than the real SAT — so test day feels easier.
            </p>
          </div>
        )}

        {error && <p className="error-text" style={{ marginBottom: '1rem', fontSize: '1rem' }}>{error}</p>}

        <button
          className="btn btn-primary"
          onClick={handleStart}
          disabled={loading}
          style={{ padding: '0.875rem 2.5rem', fontSize: '1.0625rem', fontWeight: 600 }}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
              Generating questions…
            </span>
          ) : (
            mode === 'full_test' ? 'Begin Full Test' : `Start Practice (${count} questions)`
          )}
        </button>
        {loading && (
          <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            AI is generating fresh questions for you. This takes 15–45 seconds…
          </p>
        )}
      </div>
    </div>
  );
}

function ModeCard({ selected, onClick, icon, title, desc, meta }) {
  return (
    <div
      onClick={onClick}
      style={{
        ...styles.modeCard,
        borderColor: selected ? 'var(--primary)' : 'var(--border)',
        background: selected ? 'var(--primary-light)' : 'var(--surface)',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: '1rem', color: selected ? 'var(--primary)' : 'var(--text)', marginBottom: '0.375rem' }}>{title}</div>
      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.75rem' }}>{desc}</div>
      <div style={{ fontSize: '0.8125rem', color: selected ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>{meta}</div>
      {selected && <div style={styles.checkmark}>✓</div>}
    </div>
  );
}

const styles = {
  page: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '2rem 1.5rem',
  },
  modeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  modeCard: {
    border: '2px solid',
    borderRadius: 'var(--radius)',
    padding: '1.25rem',
    position: 'relative',
    transition: 'all 0.15s',
  },
  checkmark: {
    position: 'absolute',
    top: '0.75rem',
    right: '0.75rem',
    background: 'var(--primary)',
    color: '#fff',
    width: 22,
    height: 22,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  topicGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginTop: '0.375rem',
  },
  moduleInfo: {
    background: 'rgba(255,255,255,0.6)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.625rem 0.875rem',
  },
  moduleTitle: {
    fontWeight: 600,
    fontSize: '0.875rem',
    color: 'var(--text)',
  },
  moduleMeta: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    marginTop: '0.2rem',
  },
};
