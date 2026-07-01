import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import ScoreHistoryChart from '../components/charts/ScoreHistoryChart.jsx';
import TopicAccuracyChart from '../components/charts/TopicAccuracyChart.jsx';
import api from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users/stats').then(r => setStats(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const recentTests = stats?.tests?.slice(-8).reverse() || [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div style={styles.page}>
        {/* Welcome */}
        <div style={styles.header}>
          <div>
            <h1 className="page-title">Welcome back, {user?.name?.split(' ')[0]}</h1>
            <p className="text-secondary" style={{ marginTop: '0.25rem' }}>
              {stats?.totalAttempts ? `${stats.totalAttempts} tests completed · ${stats.totalQuestions} questions answered` : 'Start your first practice test to see your stats'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/test/setup" className="btn btn-primary">
              + New Test
            </Link>
            <Link to="/test/setup?mode=custom" className="btn btn-secondary">
              Custom Practice
            </Link>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}><div className="spinner" /></div>
        ) : (
          <>
            {/* Score summary */}
            {stats?.averageScores?.total && (
              <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
                <ScoreCard label="Average Total" value={stats.averageScores.total} sub={`~${stats.averageScores.percentile}th percentile`} color="var(--primary)" />
                <ScoreCard label="Reading & Writing" value={stats.averageScores.rw ?? '—'} sub="Average scaled score" color="#10b981" />
                <ScoreCard label="Math" value={stats.averageScores.math ?? '—'} sub="Average scaled score" color="#f59e0b" />
                <ScoreCard label="Tests Completed" value={stats.totalAttempts} sub={`${stats.totalQuestions} questions total`} color="#8b5cf6" />
              </div>
            )}

            <div style={styles.twoCol}>
              {/* Score history */}
              <div className="card" style={{ flex: 2, minWidth: 0 }}>
                <h2 className="section-title">Score History</h2>
                <ScoreHistoryChart tests={stats?.tests || []} />
              </div>

              {/* Weak topics */}
              {stats?.weakTopics?.length > 0 && (
                <div className="card" style={{ flex: 1, minWidth: 0 }}>
                  <h2 className="section-title">Areas to Improve</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {stats.weakTopics.map((t, i) => (
                      <div key={i} style={styles.weakTopic}>
                        <div style={styles.weakTopicInfo}>
                          <span style={styles.weakTopicName}>{t.topic}</span>
                          <span style={styles.weakTopicSub}>{t.total} attempts</span>
                        </div>
                        <div style={styles.weakTopicAccuracy}>
                          <span style={{
                            color: t.accuracy < 50 ? 'var(--error)' : t.accuracy < 70 ? 'var(--warning)' : 'var(--success)',
                            fontWeight: 700,
                          }}>{t.accuracy}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link
                    to="/test/setup?mode=custom"
                    className="btn btn-secondary"
                    style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}
                  >
                    Practice Weak Topics →
                  </Link>
                </div>
              )}
            </div>

            {/* Topic accuracy chart */}
            {stats?.topicAccuracy?.length > 0 && (
              <div className="card" style={{ marginTop: '1.5rem' }}>
                <h2 className="section-title">Accuracy by Topic</h2>
                <TopicAccuracyChart topics={stats.topicAccuracy} />
              </div>
            )}

            {/* Recent tests */}
            {recentTests.length > 0 && (
              <div className="card" style={{ marginTop: '1.5rem' }}>
                <h2 className="section-title">Recent Tests</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {recentTests.map(t => (
                    <div key={t.id} style={styles.testRow} onClick={() => navigate(`/review/${t.id}`)}>
                      <div>
                        <div style={styles.testMode}>{formatMode(t.mode)} · {formatSection(t.section)}</div>
                        <div style={styles.testDate}>{new Date(t.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </div>
                      <div style={styles.testScores}>
                        {t.total_scaled_score && <span style={styles.testTotal}>{t.total_scaled_score}</span>}
                        {t.rw_scaled_score && <span style={styles.testSub}>R&W: {t.rw_scaled_score}</span>}
                        {t.math_scaled_score && <span style={styles.testSub}>Math: {t.math_scaled_score}</span>}
                      </div>
                      <span style={styles.reviewLink}>Review →</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats?.tests?.length === 0 && (
              <div style={styles.empty}>
                <div style={styles.emptyIcon}>📚</div>
                <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>No tests yet</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  Take your first practice test to start tracking your progress
                </p>
                <Link to="/test/setup" className="btn btn-primary">Start Practice Test</Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ScoreCard({ label, value, sub, color }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)', marginTop: '0.375rem' }}>{label}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{sub}</div>
    </div>
  );
}

function formatMode(mode) {
  return mode === 'full_test' ? 'Full Test' : 'Custom Practice';
}

function formatSection(section) {
  if (section === 'both') return 'R&W + Math';
  if (section === 'rw') return 'Reading & Writing';
  return 'Math';
}

const styles = {
  page: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '2rem 1.5rem',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '1.75rem',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  twoCol: {
    display: 'flex',
    gap: '1.25rem',
    marginBottom: '0',
    flexWrap: 'wrap',
  },
  weakTopic: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 0',
    borderBottom: '1px solid var(--border)',
  },
  weakTopicInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.1rem',
  },
  weakTopicName: {
    fontSize: '0.9rem',
    fontWeight: 500,
    color: 'var(--text)',
  },
  weakTopicSub: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  weakTopicAccuracy: {
    fontSize: '1rem',
  },
  testRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.875rem 1rem',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'background 0.15s',
    border: '1px solid var(--border)',
  },
  testMode: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: 'var(--text)',
  },
  testDate: {
    fontSize: '0.8125rem',
    color: 'var(--text-muted)',
    marginTop: '0.1rem',
  },
  testScores: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'baseline',
    marginLeft: 'auto',
  },
  testTotal: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: 'var(--primary)',
  },
  testSub: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
  },
  reviewLink: {
    fontSize: '0.875rem',
    color: 'var(--primary)',
    fontWeight: 500,
    flexShrink: 0,
  },
  empty: {
    textAlign: 'center',
    padding: '4rem 2rem',
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    marginTop: '1.5rem',
  },
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
};
