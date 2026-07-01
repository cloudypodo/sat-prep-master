import React from 'react';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export default function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  onAnswer,
  showFeedback = false,
  flagged = false,
  onFlag,
}) {
  if (!question) return null;
  const { question_text, passage, question_type, options, correct_answer, explanation, difficulty, topic } = question;

  const getOptionState = (letter) => {
    if (!showFeedback) {
      return selectedAnswer === letter ? 'selected' : 'default';
    }
    if (letter === correct_answer) return 'correct';
    if (letter === selectedAnswer && selectedAnswer !== correct_answer) return 'incorrect';
    return 'default';
  };

  const optionStyles = {
    default: { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' },
    selected: { background: 'var(--primary-light)', borderColor: 'var(--primary)', color: 'var(--primary)' },
    correct: { background: 'var(--success-light)', borderColor: 'var(--success)', color: '#059669' },
    incorrect: { background: 'var(--error-light)', borderColor: 'var(--error)', color: 'var(--error)' },
  };

  return (
    <div className="fade-in" style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.questionNum}>Question {questionNumber} of {totalQuestions}</span>
          {difficulty && (
            <span className={`badge badge-${difficulty}`}>{difficulty}</span>
          )}
          {topic && <span style={styles.topicTag}>{topic}</span>}
        </div>
        {onFlag && (
          <button
            className="btn btn-ghost"
            onClick={onFlag}
            style={{ color: flagged ? 'var(--warning)' : 'var(--text-muted)', padding: '0.3rem 0.5rem' }}
            title={flagged ? 'Unflag question' : 'Flag for review'}
          >
            {flagged ? '🚩' : '⚑'}
          </button>
        )}
      </div>

      {/* Passage */}
      {passage && (
        <div style={styles.passage}>
          <p style={styles.passageText}>{passage}</p>
        </div>
      )}

      {/* Question text */}
      <div style={styles.questionText}>{question_text}</div>

      {/* Answer area */}
      {question_type === 'multiple_choice' && options ? (
        <div style={styles.options}>
          {OPTION_LETTERS.filter(l => options[l]).map(letter => {
            const state = getOptionState(letter);
            return (
              <button
                key={letter}
                style={{ ...styles.option, ...optionStyles[state] }}
                onClick={() => !showFeedback && onAnswer?.(letter)}
                disabled={showFeedback}
              >
                <span style={{ ...styles.optionLetter, background: state === 'default' ? 'var(--bg)' : 'transparent' }}>
                  {letter}
                </span>
                <span style={styles.optionText}>{options[letter]}</span>
                {showFeedback && letter === correct_answer && (
                  <span style={{ marginLeft: 'auto', flexShrink: 0 }}>✓</span>
                )}
                {showFeedback && letter === selectedAnswer && selectedAnswer !== correct_answer && (
                  <span style={{ marginLeft: 'auto', flexShrink: 0 }}>✗</span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={styles.gridInWrap}>
          <label style={styles.gridInLabel}>Enter your answer:</label>
          <input
            type="text"
            value={selectedAnswer || ''}
            onChange={(e) => !showFeedback && onAnswer?.(e.target.value)}
            placeholder="Integer, decimal, or fraction (e.g. 3, 1.5, 3/2)"
            style={{ ...styles.gridInInput, ...(showFeedback ? { background: 'var(--bg)' } : {}) }}
            disabled={showFeedback}
          />
          {showFeedback && (
            <div style={styles.gridInCorrect}>
              Correct answer: <strong>{correct_answer}</strong>
            </div>
          )}
        </div>
      )}

      {/* Feedback explanation */}
      {showFeedback && explanation && (
        <div style={styles.explanation}>
          <div style={styles.explanationTitle}>Explanation</div>
          <p>{explanation}</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-md)',
    padding: '1.75rem',
    maxWidth: 760,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  questionNum: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  topicTag: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    background: 'var(--bg)',
    padding: '0.15rem 0.5rem',
    borderRadius: 999,
    border: '1px solid var(--border)',
  },
  passage: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '1rem 1.25rem',
    marginBottom: '1.25rem',
  },
  passageText: {
    fontSize: '0.9375rem',
    lineHeight: 1.7,
    color: 'var(--text)',
  },
  questionText: {
    fontSize: '1.0625rem',
    lineHeight: 1.65,
    color: 'var(--text)',
    marginBottom: '1.5rem',
    fontWeight: 450,
  },
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  option: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '0.875rem 1rem',
    border: '1.5px solid',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s',
    fontSize: '0.9375rem',
    lineHeight: 1.5,
  },
  optionLetter: {
    minWidth: 28,
    height: 28,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.8125rem',
    flexShrink: 0,
  },
  optionText: {
    flex: 1,
  },
  gridInWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    maxWidth: 320,
  },
  gridInLabel: {
    fontSize: '0.9375rem',
    fontWeight: 500,
    color: 'var(--text)',
  },
  gridInInput: {
    fontSize: '1.0625rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textAlign: 'center',
    maxWidth: 240,
  },
  gridInCorrect: {
    fontSize: '0.875rem',
    color: '#059669',
    marginTop: '0.25rem',
  },
  explanation: {
    marginTop: '1.5rem',
    padding: '1rem 1.25rem',
    background: 'var(--primary-light)',
    borderRadius: 'var(--radius-sm)',
    borderLeft: '3px solid var(--primary)',
  },
  explanationTitle: {
    fontWeight: 700,
    fontSize: '0.875rem',
    color: 'var(--primary)',
    marginBottom: '0.375rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
};
