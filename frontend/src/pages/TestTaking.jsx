import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import QuestionCard from '../components/QuestionCard.jsx';
import Timer from '../components/Timer.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { useTimer } from '../hooks/useTimer.js';
import api from '../api/client.js';

const MODULE_ORDER_FULL = ['rw_module1', 'rw_module2', 'math_module1', 'math_module2'];

const MODULE_LABELS = {
  rw_module1: 'Reading & Writing · Module 1',
  rw_module2: 'Reading & Writing · Module 2',
  math_module1: 'Math · Module 1',
  math_module2: 'Math · Module 2',
};

const MODULE_TIMES = {
  rw_module1: 32 * 60, rw_module2: 32 * 60,
  math_module1: 35 * 60, math_module2: 35 * 60,
};

export default function TestTaking() {
  const { testId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};

  const { mode = 'custom_practice', section = 'rw' } = state;
  const isFull = mode === 'full_test';
  const isTimed = isFull;

  // All modules' questions: { rw_module1: [...], ... }
  const [allQuestions, setAllQuestions] = useState(state.questions || {});
  // Answers per module: { rw_module1: { 0: 'A', 1: '3.5', ... }, ... }
  const [allAnswers, setAllAnswers] = useState({});
  const [flagged, setFlagged] = useState({});  // { rw_module1: Set([2, 5]) }
  const [currentModule, setCurrentModule] = useState(() => {
    if (isFull) return 'rw_module1';
    return section === 'rw' ? 'rw_module1' : 'math_module1';
  });
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [phase, setPhase] = useState('taking');  // taking | break | generating | submitting | done
  const [breakMessage, setBreakMessage] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);  // custom practice only
  const [submitting, setSubmitting] = useState(false);
  const testStartRef = useRef(Date.now());
  const qStartRef = useRef(Date.now());

  const currentQuestions = allQuestions[currentModule] || [];
  const currentQuestion = currentQuestions[currentQIndex] || null;
  const currentAnswers = allAnswers[currentModule] || {};

  // Timer
  const handleTimerExpire = useCallback(() => {
    if (isTimed) handleModuleSubmit(true);
  }, [currentModule, isTimed]);

  const timer = useTimer(MODULE_TIMES[currentModule] || 32 * 60, handleTimerExpire);

  useEffect(() => {
    if (isTimed && phase === 'taking') {
      timer.reset(MODULE_TIMES[currentModule]);
      timer.start();
    }
  }, [currentModule, phase]);

  const setAnswer = (answer) => {
    setAllAnswers(prev => ({
      ...prev,
      [currentModule]: { ...(prev[currentModule] || {}), [currentQIndex]: answer },
    }));
  };

  const toggleFlag = () => {
    setFlagged(prev => {
      const s = new Set(prev[currentModule] || []);
      if (s.has(currentQIndex)) s.delete(currentQIndex); else s.add(currentQIndex);
      return { ...prev, [currentModule]: s };
    });
  };

  const handleModuleSubmit = async (autoSubmit = false) => {
    if (submitting) return;
    timer.pause();

    const answersForModule = allAnswers[currentModule] || {};
    const answered = Object.keys(answersForModule).length;
    const unanswered = currentQuestions.length - answered;

    if (!autoSubmit && unanswered > 0) {
      const ok = window.confirm(`You have ${unanswered} unanswered question${unanswered !== 1 ? 's' : ''}. Submit anyway?`);
      if (!ok) { if (isTimed) timer.start(); return; }
    }

    setSubmitting(true);

    if (!isFull) {
      // Custom practice: go straight to complete
      await completeTest({ [currentModule]: answersForModule });
      return;
    }

    const isM1 = currentModule === 'rw_module1' || currentModule === 'math_module1';
    const sectionKey = currentModule.startsWith('rw') ? 'rw' : 'math';

    if (isM1) {
      setPhase('break');
      setBreakMessage('Scoring Module 1 and preparing Module 2…');
      try {
        const { data } = await api.post(`/tests/${testId}/module1`, {
          answers: answersForModule,
          section: sectionKey,
        });

        const m2Key = sectionKey === 'rw' ? 'rw_module2' : 'math_module2';
        setAllQuestions(prev => ({ ...prev, [m2Key]: data.module2Questions }));

        const m1Score = data.module1Score;
        const difficulty = data.harderModule2 ? 'Harder' : 'Standard';
        setBreakMessage(`Module 1 complete! ${m1Score.correct}/${m1Score.total} correct (${m1Score.accuracy}%). Module 2 difficulty: ${difficulty}`);
        setSubmitting(false);
      } catch (err) {
        setBreakMessage('Error generating Module 2. Please try again.');
        setSubmitting(false);
        return;
      }
    } else {
      // Completed a module 2 — move to next section or finish
      const nextModule = getNextModule();
      if (nextModule) {
        setPhase('break');
        setBreakMessage('Section complete! Take a short break, then continue with the next section.');
        setSubmitting(false);
      } else {
        // All modules done
        await completeTest(allAnswers);
      }
    }
  };

  const getNextModule = () => {
    if (!isFull) return null;
    const order = section === 'both' ? MODULE_ORDER_FULL : MODULE_ORDER_FULL.filter(m => m.startsWith(section));
    const idx = order.indexOf(currentModule);
    return order[idx + 1] || null;
  };

  const proceedToNextModule = () => {
    const next = getNextModule();
    if (next) {
      setCurrentModule(next);
      setCurrentQIndex(0);
      setPhase('taking');
      setSubmitting(false);
    }
  };

  const completeTest = async (answers) => {
    try {
      const elapsed = Math.round((Date.now() - testStartRef.current) / 1000);
      const { data } = await api.post(`/tests/${testId}/complete`, {
        answers,
        timeTakenSeconds: elapsed,
        mode,
      });
      navigate(`/results/${testId}`, { state: { scores: data } });
    } catch (err) {
      alert('Failed to submit test: ' + (err.response?.data?.error || err.message));
      setSubmitting(false);
    }
  };

  const navToQuestion = (i) => {
    setCurrentQIndex(i);
    qStartRef.current = Date.now();
    if (!isFull) setShowExplanation(false);
  };

  // Phases
  if (phase === 'break') {
    return <BreakScreen message={breakMessage} onContinue={proceedToNextModule} loading={submitting} isFull={isFull} />;
  }

  if (!currentQuestion) {
    return <div style={{ textAlign: 'center', padding: '4rem' }}><div className="spinner" /><p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading questions…</p></div>;
  }

  const moduleFlags = flagged[currentModule] || new Set();
  const unansweredCount = currentQuestions.length - Object.keys(currentAnswers).length;

  return (
    <div style={styles.page}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={styles.topLeft}>
          <div style={styles.moduleLabel}>{MODULE_LABELS[currentModule] || 'Practice'}</div>
          <ProgressBar current={currentQIndex + 1} total={currentQuestions.length} />
        </div>
        <div style={styles.topCenter}>
          {isTimed && <Timer {...timer} />}
        </div>
        <div style={styles.topRight}>
          {!isFull && (
            <button
              className="btn btn-ghost"
              onClick={() => setShowExplanation(prev => !prev)}
              style={{ fontSize: '0.875rem' }}
            >
              {showExplanation ? 'Hide Explanation' : 'Check Answer'}
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => handleModuleSubmit(false)}
            disabled={submitting}
            style={{ fontSize: '0.875rem' }}
          >
            {submitting ? 'Submitting…' : isFull ? 'Submit Module' : 'Finish Practice'}
          </button>
        </div>
      </div>

      <div style={styles.body}>
        {/* Question */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentQIndex + 1}
            totalQuestions={currentQuestions.length}
            selectedAnswer={currentAnswers[currentQIndex] ?? ''}
            onAnswer={setAnswer}
            showFeedback={showExplanation}
            flagged={moduleFlags.has(currentQIndex)}
            onFlag={toggleFlag}
          />

          {/* Navigation */}
          <div style={styles.navButtons}>
            <button
              className="btn btn-secondary"
              onClick={() => navToQuestion(currentQIndex - 1)}
              disabled={currentQIndex === 0}
            >
              ← Previous
            </button>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>
              {unansweredCount > 0 ? `${unansweredCount} unanswered` : '✓ All answered'}
            </span>
            <button
              className="btn btn-secondary"
              onClick={() => navToQuestion(currentQIndex + 1)}
              disabled={currentQIndex === currentQuestions.length - 1}
            >
              Next →
            </button>
          </div>
        </div>

        {/* Question nav panel */}
        <div style={styles.navPanel}>
          <div style={styles.navPanelTitle}>Questions</div>
          <div style={styles.navGrid}>
            {currentQuestions.map((_, i) => {
              const answered = currentAnswers[i] !== undefined && currentAnswers[i] !== '';
              const isFlagged = moduleFlags.has(i);
              const isCurrent = i === currentQIndex;
              return (
                <button
                  key={i}
                  onClick={() => navToQuestion(i)}
                  style={{
                    ...styles.navBtn,
                    background: isCurrent ? 'var(--primary)' : answered ? '#dbeafe' : 'var(--bg)',
                    color: isCurrent ? '#fff' : answered ? 'var(--primary)' : 'var(--text-secondary)',
                    border: isFlagged ? '2px solid var(--warning)' : '1.5px solid transparent',
                    fontWeight: isCurrent ? 700 : 500,
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div style={styles.navLegend}>
            <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: 'var(--primary)' }} /> Current</span>
            <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: '#dbeafe' }} /> Answered</span>
            <span style={styles.legendItem}><span style={{ ...styles.legendDot, border: '2px solid var(--warning)', background: 'transparent' }} /> Flagged</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BreakScreen({ message, onContinue, loading, isFull }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: '3rem' }}>
        {loading ? (
          <>
            <div className="spinner" style={{ marginBottom: '1.5rem' }} />
            <p style={{ color: 'var(--text-secondary)' }}>{message}</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
            <h2 style={{ fontWeight: 700, fontSize: '1.375rem', marginBottom: '0.75rem' }}>Module Complete</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', lineHeight: 1.6 }}>{message}</p>
            {isFull && (
              <button className="btn btn-primary" onClick={onContinue} style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>
                Continue to Next Module →
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
  },
  topBar: {
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    padding: '0.75rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
    position: 'sticky',
    top: 0,
    zIndex: 50,
    boxShadow: 'var(--shadow-sm)',
  },
  topLeft: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    minWidth: 0,
  },
  moduleLabel: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text)',
    whiteSpace: 'nowrap',
  },
  topCenter: {
    flexShrink: 0,
  },
  topRight: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    display: 'flex',
    gap: '1.5rem',
    padding: '1.75rem 1.5rem',
    maxWidth: 1100,
    margin: '0 auto',
    width: '100%',
  },
  navButtons: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '1.5rem',
    maxWidth: 760,
    margin: '1.5rem auto 0',
  },
  navPanel: {
    width: 200,
    flexShrink: 0,
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    padding: '1rem',
    alignSelf: 'flex-start',
    position: 'sticky',
    top: 80,
    boxShadow: 'var(--shadow)',
  },
  navPanelTitle: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.75rem',
  },
  navGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '0.3rem',
  },
  navBtn: {
    width: '100%',
    aspectRatio: '1',
    borderRadius: 4,
    fontSize: '0.75rem',
    cursor: 'pointer',
    transition: 'all 0.1s',
  },
  navLegend: {
    marginTop: '0.875rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.3rem',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.7rem',
    color: 'var(--text-secondary)',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    flexShrink: 0,
  },
};
