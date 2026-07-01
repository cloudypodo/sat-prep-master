import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../database.js';
import { getPercentile } from '../services/scoringService.js';

const router = Router();
router.use(requireAuth);

// GET /api/users/me
router.get('/me', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// GET /api/users/stats — aggregate performance data for dashboard
router.get('/stats', (req, res) => {
  const db = getDb();

  const tests = db.prepare(`
    SELECT id, mode, section, rw_scaled_score, math_scaled_score, total_scaled_score,
           rw_raw_score, math_raw_score, time_taken_seconds, completed_at
    FROM test_attempts WHERE user_id = ? AND status = 'completed'
    ORDER BY completed_at ASC
  `).all(req.userId);

  if (tests.length === 0) {
    return res.json({ tests: [], topicAccuracy: [], weakTopics: [], averageScores: null });
  }

  // Topic accuracy across all test questions
  const allQuestions = db.prepare(`
    SELECT tq.question_data, tq.is_correct, tq.time_spent_seconds, ta.section
    FROM test_questions tq
    JOIN test_attempts ta ON ta.id = tq.attempt_id
    WHERE ta.user_id = ? AND ta.status = 'completed' AND tq.is_correct IS NOT NULL
  `).all(req.userId);

  const topicMap = {};
  for (const q of allQuestions) {
    const data = JSON.parse(q.question_data);
    const topic = data.topic || 'Unknown';
    if (!topicMap[topic]) topicMap[topic] = { correct: 0, total: 0, timeSamples: [] };
    topicMap[topic].total++;
    if (q.is_correct) topicMap[topic].correct++;
    if (q.time_spent_seconds) topicMap[topic].timeSamples.push(q.time_spent_seconds);
  }

  const topicAccuracy = Object.entries(topicMap).map(([topic, stats]) => ({
    topic,
    correct: stats.correct,
    total: stats.total,
    accuracy: Math.round((stats.correct / stats.total) * 100),
    avgTime: stats.timeSamples.length > 0
      ? Math.round(stats.timeSamples.reduce((a, b) => a + b, 0) / stats.timeSamples.length)
      : null,
  })).sort((a, b) => b.total - a.total);

  // Weak topics: lowest accuracy among topics with ≥3 attempts
  const weakTopics = [...topicAccuracy]
    .filter(t => t.total >= 3)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  // Average scores
  const recentTests = tests.slice(-10);
  const avgRW = average(recentTests.map(t => t.rw_scaled_score).filter(Boolean));
  const avgMath = average(recentTests.map(t => t.math_scaled_score).filter(Boolean));
  const avgTotal = average(recentTests.map(t => t.total_scaled_score).filter(Boolean));

  res.json({
    tests,
    topicAccuracy,
    weakTopics,
    averageScores: {
      rw: avgRW,
      math: avgMath,
      total: avgTotal,
      percentile: avgTotal ? getPercentile(avgTotal) : null,
    },
    totalAttempts: tests.length,
    totalQuestions: allQuestions.length,
  });
});

function average(arr) {
  if (!arr.length) return null;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

export default router;
