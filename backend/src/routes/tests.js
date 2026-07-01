import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../database.js';
import { generateModuleQuestions, generateRWQuestions, generateMathQuestions } from '../services/questionGenerator.js';
import { calculateScaledScore, calculateTestScores } from '../services/scoringService.js';
import { validateGridIn, validateMultipleChoice } from '../utils/answerValidator.js';

const router = Router();
router.use(requireAuth);

// SAT module specs
const MODULE_SPECS = {
  rw_module1: { section: 'rw', count: 27, timeSeconds: 32 * 60 },
  rw_module2: { section: 'rw', count: 27, timeSeconds: 32 * 60 },
  math_module1: { section: 'math', count: 22, timeSeconds: 35 * 60 },
  math_module2: { section: 'math', count: 22, timeSeconds: 35 * 60 },
};

// POST /api/tests — start a new test attempt and generate Module 1 questions
router.post('/', async (req, res) => {
  const { mode, section, topics, difficulty, count } = req.body;
  // mode: 'full_test' | 'custom_practice'
  // section: 'rw' | 'math' | 'both' (full_test uses 'both')

  try {
    const db = getDb();
    const result = db.prepare(
      'INSERT INTO test_attempts (user_id, mode, section, status) VALUES (?, ?, ?, ?)'
    ).run(req.userId, mode, section, 'in_progress');
    const testId = result.lastInsertRowid;

    let questions = {};

    if (mode === 'custom_practice') {
      const questionCount = count || (section === 'rw' ? 27 : 22);
      const qs = section === 'rw'
        ? await generateRWQuestions({ count: questionCount, difficulty: difficulty || 'medium', topics: topics || [] })
        : await generateMathQuestions({ count: questionCount, difficulty: difficulty || 'medium', topics: topics || [] });

      const module = section === 'rw' ? 'rw_module1' : 'math_module1';
      saveQuestions(db, testId, module, qs);
      questions[module] = qs;
    } else {
      // Full test: generate both Module 1s upfront
      const [rwM1, mathM1] = await Promise.all([
        generateModuleQuestions({ section: 'rw', count: 27, difficultyPool: 'standard' }),
        generateModuleQuestions({ section: 'math', count: 22, difficultyPool: 'standard' }),
      ]);
      saveQuestions(db, testId, 'rw_module1', rwM1);
      saveQuestions(db, testId, 'math_module1', mathM1);
      questions.rw_module1 = rwM1;
      questions.math_module1 = mathM1;
    }

    res.status(201).json({ testId, questions, moduleSpecs: MODULE_SPECS });
  } catch (err) {
    console.error('Test creation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate test' });
  }
});

// POST /api/tests/:id/module1 — submit Module 1 answers, generate Module 2 questions
router.post('/:id/module1', async (req, res) => {
  const { answers, section, timeTakenSeconds } = req.body;
  // answers: { questionIndex: "A" | "B" | "C" | "D" | numeric_string }
  const testId = parseInt(req.params.id);

  try {
    const db = getDb();
    const attempt = db.prepare('SELECT * FROM test_attempts WHERE id = ? AND user_id = ?').get(testId, req.userId);
    if (!attempt) return res.status(404).json({ error: 'Test not found' });

    const moduleKey = section === 'rw' ? 'rw_module1' : 'math_module1';
    const storedQs = db.prepare('SELECT * FROM test_questions WHERE attempt_id = ? AND module = ? ORDER BY question_index').all(testId, moduleKey);

    // Score module 1
    let correct = 0;
    const updateQ = db.prepare('UPDATE test_questions SET user_answer = ?, is_correct = ?, time_spent_seconds = ? WHERE id = ?');
    const updateMany = db.transaction((rows) => { rows.forEach(r => updateQ.run(...r)); });
    const updateRows = [];

    for (const q of storedQs) {
      const qData = JSON.parse(q.question_data);
      const userAns = answers[String(q.question_index)];
      let isCorrect = false;
      if (userAns !== undefined && userAns !== null) {
        isCorrect = qData.question_type === 'grid_in'
          ? validateGridIn(userAns, qData.correct_answer, qData.accepted_answers)
          : validateMultipleChoice(userAns, qData.correct_answer);
      }
      if (isCorrect) correct++;
      updateRows.push([String(userAns ?? ''), isCorrect ? 1 : 0, null, q.id]);
    }
    updateMany(updateRows);

    const total = storedQs.length;
    const accuracy = correct / total;
    const harderPool = accuracy >= 0.70;

    // Store M1 stats
    if (section === 'rw') {
      db.prepare('UPDATE test_attempts SET rw_m1_correct = ?, rw_m1_total = ?, adaptive_harder_rw = ? WHERE id = ?')
        .run(correct, total, harderPool ? 1 : 0, testId);
    } else {
      db.prepare('UPDATE test_attempts SET math_m1_correct = ?, math_m1_total = ?, adaptive_harder_math = ? WHERE id = ?')
        .run(correct, total, harderPool ? 1 : 0, testId);
    }

    // Generate Module 2 based on M1 performance
    const pool = harderPool ? 'harder' : 'easier';
    const m2Count = section === 'rw' ? 27 : 22;
    const m2Qs = await generateModuleQuestions({ section, count: m2Count, difficultyPool: pool });
    const m2ModuleKey = section === 'rw' ? 'rw_module2' : 'math_module2';
    saveQuestions(db, testId, m2ModuleKey, m2Qs);

    res.json({
      module1Score: { correct, total, accuracy: Math.round(accuracy * 100) },
      harderModule2: harderPool,
      module2Questions: m2Qs,
    });
  } catch (err) {
    console.error('Module 1 submission error:', err);
    res.status(500).json({ error: err.message || 'Failed to process module 1' });
  }
});

// POST /api/tests/:id/complete — submit all remaining answers and calculate final score
router.post('/:id/complete', async (req, res) => {
  const { answers, timeTakenSeconds, mode } = req.body;
  // answers: { module: { questionIndex: answer } }
  const testId = parseInt(req.params.id);

  try {
    const db = getDb();
    const attempt = db.prepare('SELECT * FROM test_attempts WHERE id = ? AND user_id = ?').get(testId, req.userId);
    if (!attempt) return res.status(404).json({ error: 'Test not found' });

    const allQs = db.prepare('SELECT * FROM test_questions WHERE attempt_id = ? ORDER BY module, question_index').all(testId);
    const updateQ = db.prepare('UPDATE test_questions SET user_answer = ?, is_correct = ? WHERE id = ?');
    const updateMany = db.transaction((rows) => { rows.forEach(r => updateQ.run(...r)); });
    const updateRows = [];

    const moduleCounts = {};

    for (const q of allQs) {
      // Skip already-scored M1 questions (they were scored in /module1)
      if (q.user_answer !== null && q.is_correct !== null) {
        const mod = q.module;
        if (!moduleCounts[mod]) moduleCounts[mod] = { correct: 0, total: 0 };
        moduleCounts[mod].total++;
        if (q.is_correct) moduleCounts[mod].correct++;
        continue;
      }

      const qData = JSON.parse(q.question_data);
      const moduleAnswers = answers[q.module] || {};
      const userAns = moduleAnswers[String(q.question_index)];
      let isCorrect = false;
      if (userAns !== undefined && userAns !== null && String(userAns).trim() !== '') {
        isCorrect = qData.question_type === 'grid_in'
          ? validateGridIn(userAns, qData.correct_answer, qData.accepted_answers)
          : validateMultipleChoice(userAns, qData.correct_answer);
      }

      const mod = q.module;
      if (!moduleCounts[mod]) moduleCounts[mod] = { correct: 0, total: 0 };
      moduleCounts[mod].total++;
      if (isCorrect) moduleCounts[mod].correct++;
      updateRows.push([String(userAns ?? ''), isCorrect ? 1 : 0, q.id]);
    }
    updateMany(updateRows);

    // Calculate section raw scores
    const rwRaw = ((moduleCounts.rw_module1?.correct || 0) + (moduleCounts.rw_module2?.correct || 0));
    const mathRaw = ((moduleCounts.math_module1?.correct || 0) + (moduleCounts.math_module2?.correct || 0));

    const hasRW = !!(moduleCounts.rw_module1 || moduleCounts.rw_module2);
    const hasMath = !!(moduleCounts.math_module1 || moduleCounts.math_module2);

    const rwScaled = hasRW ? calculateScaledScore(rwRaw, 'rw') : null;
    const mathScaled = hasMath ? calculateScaledScore(mathRaw, 'math') : null;
    const total = (rwScaled || 0) + (mathScaled || 0);

    db.prepare(`
      UPDATE test_attempts SET
        rw_m2_correct = ?, rw_m2_total = ?,
        math_m2_correct = ?, math_m2_total = ?,
        rw_raw_score = ?, math_raw_score = ?,
        rw_scaled_score = ?, math_scaled_score = ?,
        total_scaled_score = ?, time_taken_seconds = ?,
        status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      moduleCounts.rw_module2?.correct ?? null, moduleCounts.rw_module2?.total ?? null,
      moduleCounts.math_module2?.correct ?? null, moduleCounts.math_module2?.total ?? null,
      hasRW ? rwRaw : null, hasMath ? mathRaw : null,
      rwScaled, mathScaled, total || null,
      timeTakenSeconds || null,
      testId
    );

    res.json({
      testId,
      rwRaw, mathRaw,
      rwScaled, mathScaled,
      total,
      moduleCounts,
    });
  } catch (err) {
    console.error('Complete test error:', err);
    res.status(500).json({ error: err.message || 'Failed to complete test' });
  }
});

// GET /api/tests/history — list completed tests for current user
router.get('/history', (req, res) => {
  const db = getDb();
  const tests = db.prepare(`
    SELECT id, mode, section, rw_scaled_score, math_scaled_score, total_scaled_score,
           rw_raw_score, math_raw_score, time_taken_seconds, status, completed_at, created_at
    FROM test_attempts WHERE user_id = ? AND status = 'completed'
    ORDER BY completed_at DESC LIMIT 50
  `).all(req.userId);
  res.json(tests);
});

// GET /api/tests/:id — full test detail for review
router.get('/:id', (req, res) => {
  const testId = parseInt(req.params.id);
  const db = getDb();
  const attempt = db.prepare('SELECT * FROM test_attempts WHERE id = ? AND user_id = ?').get(testId, req.userId);
  if (!attempt) return res.status(404).json({ error: 'Test not found' });

  const questions = db.prepare('SELECT * FROM test_questions WHERE attempt_id = ? ORDER BY module, question_index').all(testId);
  const parsed = questions.map(q => ({
    ...q,
    question_data: JSON.parse(q.question_data),
  }));

  res.json({ attempt, questions: parsed });
});

function saveQuestions(db, testId, module, questions) {
  const insert = db.prepare('INSERT INTO test_questions (attempt_id, module, question_index, question_data) VALUES (?, ?, ?, ?)');
  const insertMany = db.transaction((qs) => {
    qs.forEach((q, i) => insert.run(testId, module, i, JSON.stringify(q)));
  });
  insertMany(questions);
}

export default router;
