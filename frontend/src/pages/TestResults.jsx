import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import TopicAccuracyChart from '../components/charts/TopicAccuracyChart.jsx';
import api from '../api/client.js';

export default function TestResults() {
  const { testId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  // Scores may be passed via navigation state for immediate display
  const passedScores = location.state?.scores;

  useEffect(() => {
    api.get(`/tests/${testId}`).then(r => {
      setDetail(r.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [testId]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <Navbar />
        <div style={{ textAlign: 'center', padding: '5rem' }}><div className="spinner" /></div>
      </div>
    );
  }

  const attempt = detail?.attempt;
  const questions = detail?.questions || [];

  const rwScaled = attempt?.rw_scaled_score;
  const mathScaled = attempt?.math_scaled_score;
  const total = attempt?.total_scaled_score;

  // Build topic accuracy from questions
  const topicMap = {};
  questions.forEach(q => {
    if (q.is_correct === null) return;
    const topic = q.question_data?.topic || 'Unknown';
    if (!topicMap[topic]) topicMap[topic] = { correct: 0, total: 0 };
    topicMap[topic].total++;
    if (q.is_correct) topicMap[topic].correct++;
  });
  const topicAccuracy = Object.entries(topicMap).map(([topic, s]) => ({
    topic,
    correct: s.correct,
    total: s.total,
    accuracy: Math.round((s.correct / s.total) * 100),
  })).sort((a, b) => b.total - a.total);

  const totalCorrect = questions.filter(q => q.is_correct).length;
  const totalAnswered = questions.filter(q => q.user_answer !== null && q.user_answer !== '').length;
  const accuracy = questions.length > 0 ? Math.round((totalCorrect / questions.length) * 100) : 0;

  const weakTopics = [...topicAccuracy].filter(t => t.total >= 2).sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div style={styles.page}>
        <div style={styles.header}>
          <h1 className="page-title">Test Results</h1>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link to={`/review/${testId}`} className="btn btn-secondary">Review Answers</Link>
            <Link to="/test/setup" className="btn btn-primary">Take Another Test</Link>
          </div>
        </div>

        {/* Score banner */}
        <div style={styles.scoreBanner}>
          {total && (
            <div style={styles.totalScore}>
              <div style={styles.totalScoreValue}>{total}</div>
              <div style={styles.totalScoreLabel}>Estimated SAT Score</div>
              <div style={styles.totalScoreSub}>out of 1600</div>
            </div>
          )}
          <div style={styles.sectionScores}>
            {rwScaled && (
              <div style={styles.sectionScore}>
                <div style={{ ...styles.sectionScoreValue, color: '#10b981' }}>{rwScaled}</div>
                <div style={styles.sectionScoreLabel}>Reading & Writing</div>
                <div style={styles.sectionScoreSub}>out of 800</div>
              </div>
            )}
            {mathScaled && (
              <div style={styles.sectionScore}>
                <div style={{ ...styles.sectionScoreValue, color: '#f59e0b' }}>{mathScaled}</div>
                <div style={styles.sectionScoreLabel}>Math</div>
                <div style={styles.sectionScoreSub}>out of 800</div>
              </div>
            )}
            <div style={styles.sectionScore}>
              <div style={{ ...styles.sectionScoreValue, color: 'var(--primary)' }}>{accuracy}%</div>
              <div style={styles.sectionScoreLabel}>Overall Accuracy</div>
              <div style={styles.sectionScoreSub}>{totalCorrect}/{questions.length} correct</div>
            </div>
          </div>
        </div>

        {/* Score note */}
        <div style={styles.note}>
          <strong>About this score:</strong> This estimate is based on a raw-to-scaled conversion modeled on College Board's actual SAT scoring curves. Because practice questions are calibrated slightly harder than the real SAT, a small difficulty bonus is applied so the estimate reflects what you'd likely score on test day. College Board's exact curve varies test to test.
        </div>

        {/* Module breakdown */}
        {(attempt?.rw_m1_correct !== null || attempt?.math_m1_correct !== null) && (
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h2 className="section-title">Module Breakdown</h2>
            <div className="grid-2">
              {attempt?.rw_m1_total && <ModuleRow label="R&W Module 1" correct={attempt.rw_m1_correct} total={attempt.rw_m1_total} />}
              {attempt?.rw_m2_total && <ModuleRow label="R&W Module 2" correct={attempt.rw_m2_correct} total={attempt.rw_m2_total} harder={attempt.adaptive_harder_rw} />}
              {attempt?.math_m1_total && <ModuleRow label="Math Module 1" correct={attempt.math_m1_correct} total={attempt.math_m1_total} />}
              {attempt?.math_m2_total && <ModuleRow label="Math Module 2" correct={attempt.math_m2_correct} total={attempt.math_m2_total} harder={attempt.adaptive_harder_math} />}
            </div>
          </div>
        )}

        {/* Weak topics */}
        {weakTopics.length > 0 && (
          <div className="card" style={{ marginBottom: '1.25rem', background: 'var(--warning-light)', border: '1px solid #fde68a' }}>
            <h2 className="section-title" style={{ color: '#92400e' }}>Focus Areas</h2>
            <p style={{ fontSize: '0.9rem', color: '#78350f', marginBottom: '1rem' }}>
              Your weakest topics from this test — consider targeted practice sessions on these:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', marginBottom: '1rem' }}>
              {weakTopics.map(t => (
                <div key={t.topic} style={styles.weakChip}>
                  <span style={{ fontWeight: 600 }}>{t.topic}</span>
                  <span style={{ marginLeft: '0.5rem', opacity: 0.8 }}>{t.accuracy}%</span>
                </div>
              ))}
            </div>
            <Link to="/test/setup?mode=custom" className="btn" style={{ background: '#92400e', color: '#fff', fontSize: '0.875rem' }}>
              Practice These Topics →
            </Link>
          </div>
        )}

        {/* Topic accuracy */}
        {topicAccuracy.length > 0 && (
          <div className="card">
            <h2 className="section-title">Accuracy by Topic</h2>
            <TopicAccuracyChart topics={topicAccuracy} />
          </div>
        )}
      </div>
    </div>
  );
}

function ModuleRow({ label, correct, total, harder }) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{label}</div>
        {harder !== undefined && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
            {harder ? '🔴 Harder pool (adaptive)' : '🟢 Standard pool (adaptive)'}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 700, fontSize: '1.125rem', color: pct >= 70 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--error)' }}>{pct}%</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{correct}/{total}</div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '2rem 1.5rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.75rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  scoreBanner: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-md)',
    padding: '2rem',
    marginBottom: '1.25rem',
    display: 'flex',
    gap: '2rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  totalScore: {
    textAlign: 'center',
    flexShrink: 0,
    padding: '1rem 2rem',
    borderRight: '1px solid var(--border)',
  },
  totalScoreValue: {
    fontSize: '4rem',
    fontWeight: 900,
    color: 'var(--primary)',
    lineHeight: 1,
    letterSpacing: '-0.03em',
  },
  totalScoreLabel: {
    fontWeight: 700,
    fontSize: '1rem',
    color: 'var(--text)',
    marginTop: '0.375rem',
  },
  totalScoreSub: {
    fontSize: '0.8125rem',
    color: 'var(--text-muted)',
  },
  sectionScores: {
    display: 'flex',
    gap: '2rem',
    flex: 1,
    flexWrap: 'wrap',
  },
  sectionScore: {
    textAlign: 'center',
  },
  sectionScoreValue: {
    fontSize: '2.5rem',
    fontWeight: 800,
    lineHeight: 1,
  },
  sectionScoreLabel: {
    fontWeight: 600,
    fontSize: '0.875rem',
    color: 'var(--text)',
    marginTop: '0.25rem',
  },
  sectionScoreSub: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  note: {
    background: 'var(--primary-light)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.875rem 1.125rem',
    fontSize: '0.8125rem',
    color: 'var(--primary)',
    marginBottom: '1.25rem',
    lineHeight: 1.6,
    borderLeft: '3px solid var(--primary)',
  },
  weakChip: {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 999,
    padding: '0.3rem 0.875rem',
    fontSize: '0.875rem',
    color: '#92400e',
  },
};
