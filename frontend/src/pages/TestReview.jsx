import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import QuestionCard from '../components/QuestionCard.jsx';
import api from '../api/client.js';

const MODULE_LABELS = {
  rw_module1: 'R&W Module 1', rw_module2: 'R&W Module 2',
  math_module1: 'Math Module 1', math_module2: 'Math Module 2',
};

export default function TestReview() {
  const { testId } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');  // all | incorrect | flagged
  const [selectedModule, setSelectedModule] = useState('all');
  const [expandedQ, setExpandedQ] = useState(null);

  useEffect(() => {
    api.get(`/tests/${testId}`)
      .then(r => setDetail(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [testId]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <Navbar />
        <div style={{ textAlign: 'center', padding: '5rem' }}><div className="spinner" /></div>
      </div>
    );
  }

  const { attempt, questions = [] } = detail || {};

  const modules = [...new Set(questions.map(q => q.module))];

  const filtered = questions.filter(q => {
    if (selectedModule !== 'all' && q.module !== selectedModule) return false;
    if (filter === 'incorrect') return q.is_correct === 0;
    return true;
  });

  const totalCorrect = questions.filter(q => q.is_correct === 1).length;
  const accuracy = questions.length > 0 ? Math.round((totalCorrect / questions.length) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <Link to={`/results/${testId}`} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'inline-block' }}>
              ← Back to Results
            </Link>
            <h1 className="page-title">Test Review</h1>
            {attempt?.completed_at && (
              <p className="text-secondary" style={{ marginTop: '0.25rem' }}>
                {new Date(attempt.completed_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                {attempt.total_scaled_score && ` · Score: ${attempt.total_scaled_score}`}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={styles.statsRow}>
          <div className="card" style={styles.statCard}>
            <div style={styles.statValue}>{totalCorrect}/{questions.length}</div>
            <div style={styles.statLabel}>Correct</div>
          </div>
          <div className="card" style={styles.statCard}>
            <div style={{ ...styles.statValue, color: accuracy >= 70 ? 'var(--success)' : accuracy >= 50 ? 'var(--warning)' : 'var(--error)' }}>{accuracy}%</div>
            <div style={styles.statLabel}>Accuracy</div>
          </div>
          {attempt?.rw_scaled_score && (
            <div className="card" style={styles.statCard}>
              <div style={{ ...styles.statValue, color: '#10b981' }}>{attempt.rw_scaled_score}</div>
              <div style={styles.statLabel}>R&W Score</div>
            </div>
          )}
          {attempt?.math_scaled_score && (
            <div className="card" style={styles.statCard}>
              <div style={{ ...styles.statValue, color: '#f59e0b' }}>{attempt.math_scaled_score}</div>
              <div style={styles.statLabel}>Math Score</div>
            </div>
          )}
          {attempt?.total_scaled_score && (
            <div className="card" style={styles.statCard}>
              <div style={{ ...styles.statValue, color: 'var(--primary)' }}>{attempt.total_scaled_score}</div>
              <div style={styles.statLabel}>Total Score</div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div style={styles.filters}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['all', 'incorrect'].map(f => (
              <button
                key={f}
                className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(f)}
                style={{ fontSize: '0.875rem', padding: '0.4rem 0.875rem' }}
              >
                {f === 'all' ? 'All Questions' : 'Missed Only'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className={`btn ${selectedModule === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setSelectedModule('all')}
              style={{ fontSize: '0.8125rem' }}
            >
              All Modules
            </button>
            {modules.map(m => (
              <button
                key={m}
                className={`btn ${selectedModule === m ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSelectedModule(m)}
                style={{ fontSize: '0.8125rem' }}
              >
                {MODULE_LABELS[m] || m}
              </button>
            ))}
          </div>
        </div>

        <p style={{ marginBottom: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Showing {filtered.length} of {questions.length} questions
        </p>

        {/* Questions list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map((q, i) => {
            const qData = q.question_data;
            const isCorrect = q.is_correct === 1;
            const isExpanded = expandedQ === q.id;

            return (
              <div key={q.id} style={styles.questionRow}>
                {/* Row header */}
                <div
                  style={{ ...styles.questionHeader, borderBottom: isExpanded ? '1px solid var(--border)' : 'none' }}
                  onClick={() => setExpandedQ(isExpanded ? null : q.id)}
                >
                  <div style={styles.questionMeta}>
                    <span style={{
                      ...styles.resultDot,
                      background: isCorrect ? 'var(--success)' : q.is_correct === 0 ? 'var(--error)' : 'var(--border)',
                    }} />
                    <span style={styles.qNum}>Q{q.question_index + 1}</span>
                    <span style={styles.qModule}>{MODULE_LABELS[q.module] || q.module}</span>
                    {qData?.topic && <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{qData.topic}</span>}
                    {qData?.difficulty && <span className={`badge badge-${qData.difficulty}`}>{qData.difficulty}</span>}
                  </div>
                  <div style={styles.answerSummary}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      Your answer: <strong style={{ color: isCorrect ? 'var(--success)' : 'var(--error)' }}>{q.user_answer || '(no answer)'}</strong>
                    </span>
                    {!isCorrect && (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginLeft: '1rem' }}>
                        Correct: <strong style={{ color: 'var(--success)' }}>{qData?.correct_answer}</strong>
                      </span>
                    )}
                    <span style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded question */}
                {isExpanded && (
                  <div style={{ padding: '1.25rem' }}>
                    <QuestionCard
                      question={qData}
                      questionNumber={q.question_index + 1}
                      totalQuestions={questions.length}
                      selectedAnswer={q.user_answer}
                      showFeedback={true}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            No questions match the current filter.
          </div>
        )}
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
    marginBottom: '1.5rem',
  },
  statsRow: {
    display: 'flex',
    gap: '0.875rem',
    flexWrap: 'wrap',
    marginBottom: '1.5rem',
  },
  statCard: {
    textAlign: 'center',
    padding: '1rem 1.25rem',
    minWidth: 90,
  },
  statValue: {
    fontSize: '1.75rem',
    fontWeight: 800,
    color: 'var(--primary)',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    fontWeight: 500,
    marginTop: '0.3rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  filters: {
    display: 'flex',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  questionRow: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
  },
  questionHeader: {
    padding: '0.875rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  questionMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  resultDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  qNum: {
    fontWeight: 700,
    fontSize: '0.9rem',
    color: 'var(--text)',
  },
  qModule: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
  },
  answerSummary: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    flexWrap: 'wrap',
  },
  expandIcon: {
    marginLeft: '0.75rem',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
};
