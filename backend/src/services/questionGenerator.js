import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert SAT question writer with deep knowledge of College Board's SAT format, difficulty levels, and scoring. Generate authentic SAT-style practice questions.

DIFFICULTY CALIBRATION (critical):
- "easy" requested → generate at real SAT "medium" difficulty
- "medium" requested → generate at real SAT "hard" difficulty
- "hard" requested → generate at real SAT's hardest difficulty (top 5% territory)
Make questions intentionally tougher by: adding an extra reasoning step, creating subtle distractors that seem plausible but fail under close reading, using less obvious wording, or requiring synthesis of multiple pieces of information. The goal is that the real SAT feels easier by comparison.

OUTPUT RULES:
- Return ONLY a valid JSON array. No markdown fences, no explanatory text outside the array.
- Every field must be present; use null for fields not applicable to a question type.
- All question_type values must be exactly "multiple_choice" or "grid_in".`;

const RW_DOMAINS = {
  information_and_ideas: ['Central Ideas & Details', 'Command of Evidence', 'Inferences'],
  craft_and_structure: ['Words in Context', 'Text Structure & Purpose', 'Cross-Text Connections'],
  expression_of_ideas: ['Rhetorical Synthesis', 'Transitions'],
  standard_english_conventions: ['Boundaries', 'Form, Structure, & Sense'],
};

const MATH_TOPICS = {
  algebra: ['Linear Equations (One Variable)', 'Linear Equations (Two Variables)', 'Linear Functions', 'Systems of Linear Equations', 'Linear Inequalities'],
  advanced_math: ['Equivalent Expressions', 'Nonlinear Equations', 'Nonlinear Functions'],
  problem_solving_data: ['Ratios, Rates & Proportions', 'Percentages', 'One-Variable Data', 'Two-Variable Data', 'Probability', 'Inference & Statistics'],
  geometry_trig: ['Area & Volume', 'Lines, Angles & Triangles', 'Right Triangles & Trigonometry', 'Circles'],
};

function buildRWPrompt(count, difficulty, topics) {
  const topicList = topics.join(', ');
  return `Generate ${count} SAT Reading & Writing questions.

Specifications:
- Topics/Skills: ${topicList}
- Difficulty: ${difficulty} (apply calibration: make it one tier harder than stated)
- Format: ALL must be multiple_choice with exactly 4 options (A, B, C, D)
- Reading passages: include a passage (60–130 words) whenever the skill is reading-based (Central Ideas, Command of Evidence, Inferences, Words in Context, Text Structure, Cross-Text Connections, Rhetorical Synthesis, Transitions). Grammar/conventions questions (Boundaries, Form Structure Sense) do NOT need a passage — just a sentence or short paragraph with a blank or underline.

Return a JSON array exactly matching this schema:
[
  {
    "question_text": "string — the question stem",
    "passage": "string or null",
    "question_type": "multiple_choice",
    "options": { "A": "string", "B": "string", "C": "string", "D": "string" },
    "correct_answer": "A",
    "accepted_answers": null,
    "explanation": "2–3 sentences: why the correct answer is right and why the most tempting distractor is wrong",
    "difficulty": "${difficulty}",
    "topic": "string — the specific skill being tested"
  }
]`;
}

function buildMathPrompt(mcCount, gridInCount, difficulty, topics) {
  const topicList = topics.join(', ');
  const total = mcCount + gridInCount;
  return `Generate ${total} SAT Math questions: ${mcCount} multiple_choice and ${gridInCount} grid_in.

Specifications:
- Topics: ${topicList}
- Difficulty: ${difficulty} (apply calibration: make it one tier harder than stated)
- Multiple choice: exactly 4 options (A, B, C, D)
- Grid-in: the student produces a numeric answer. Answer must be a POSITIVE number (integer, decimal, or fraction). No negatives, consistent with real SAT grid-in rules. Include equivalent accepted forms when relevant (e.g., "1/2" and "0.5" and ".5" for the same value).

Return a JSON array exactly matching this schema:
[
  {
    "question_text": "string",
    "passage": null,
    "question_type": "multiple_choice",
    "options": { "A": "string", "B": "string", "C": "string", "D": "string" },
    "correct_answer": "A",
    "accepted_answers": null,
    "explanation": "string",
    "difficulty": "${difficulty}",
    "topic": "string"
  },
  {
    "question_text": "string",
    "passage": null,
    "question_type": "grid_in",
    "options": null,
    "correct_answer": "7.5",
    "accepted_answers": ["15/2", "7.5"],
    "explanation": "string",
    "difficulty": "${difficulty}",
    "topic": "string"
  }
]

Generate exactly ${mcCount} multiple_choice first, then ${gridInCount} grid_in.`;
}

async function callClaude(prompt, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].text.trim();

      // Extract JSON array — handle responses with stray text before/after
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('No JSON array in response');

      const questions = JSON.parse(match[0]);
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Empty or non-array JSON returned');
      }

      // Validate each question has required fields
      return questions.filter(validateQuestion);
    } catch (err) {
      if (attempt === retries) throw new Error(`Question generation failed after ${retries + 1} attempts: ${err.message}`);
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

function validateQuestion(q) {
  if (!q.question_text || !q.question_type || !q.correct_answer || !q.explanation || !q.topic) return false;
  if (q.question_type === 'multiple_choice' && (!q.options || !q.options.A || !q.options.B || !q.options.C || !q.options.D)) return false;
  return true;
}

function selectTopics(section, topicKeys) {
  if (topicKeys && topicKeys.length > 0) return topicKeys;
  if (section === 'rw') {
    return Object.values(RW_DOMAINS).flat();
  }
  return Object.values(MATH_TOPICS).flat();
}

// Generate questions in batches to stay within token limits
const BATCH_SIZE = 9;

export async function generateRWQuestions({ count, difficulty = 'medium', topics = [] }) {
  const resolvedTopics = selectTopics('rw', topics);
  const allQuestions = [];
  let remaining = count;

  while (remaining > 0) {
    const batchCount = Math.min(BATCH_SIZE, remaining);
    // Rotate topics through batches for variety
    const batchTopics = resolvedTopics.slice(0, Math.min(3, resolvedTopics.length));
    const prompt = buildRWPrompt(batchCount, difficulty, batchTopics);
    const batch = await callClaude(prompt);
    allQuestions.push(...batch.slice(0, batchCount));
    remaining -= batchCount;
  }

  return allQuestions.slice(0, count);
}

export async function generateMathQuestions({ count, difficulty = 'medium', topics = [] }) {
  const resolvedTopics = selectTopics('math', topics);

  // Maintain ~75% MC, ~25% grid-in ratio per real SAT
  const gridInCount = Math.round(count * 0.25);
  const mcCount = count - gridInCount;

  const allQuestions = [];
  let mcRemaining = mcCount;
  let gridRemaining = gridInCount;

  while (mcRemaining > 0 || gridRemaining > 0) {
    const batchMC = Math.min(Math.ceil(BATCH_SIZE * 0.75), mcRemaining);
    const batchGrid = Math.min(BATCH_SIZE - batchMC, gridRemaining);
    const batchTopics = resolvedTopics.slice(0, Math.min(3, resolvedTopics.length));
    const prompt = buildMathPrompt(batchMC, batchGrid, difficulty, batchTopics);
    const batch = await callClaude(prompt);

    // Separate by type since Claude puts MC first per our prompt
    const batchMCQs = batch.filter(q => q.question_type === 'multiple_choice').slice(0, batchMC);
    const batchGridQs = batch.filter(q => q.question_type === 'grid_in').slice(0, batchGrid);
    allQuestions.push(...batchMCQs, ...batchGridQs);

    mcRemaining -= batchMCQs.length;
    gridRemaining -= batchGridQs.length;

    // If we didn't get enough of a type, stop to avoid infinite loop
    if (batchMCQs.length === 0 && batchGridQs.length === 0) break;
  }

  return allQuestions.slice(0, count);
}

export async function generateModuleQuestions({ section, count, difficulty, difficultyPool, topics }) {
  // difficultyPool: 'standard', 'harder', 'easier'
  const effectiveDifficulty = resolvePoolDifficulty(difficulty, difficultyPool);
  if (section === 'rw') {
    return generateRWQuestions({ count, difficulty: effectiveDifficulty, topics });
  }
  return generateMathQuestions({ count, difficulty: effectiveDifficulty, topics });
}

function resolvePoolDifficulty(base, pool) {
  if (pool === 'harder') return 'hard';
  if (pool === 'easier') return 'easy';
  return base || 'medium';
}

export { RW_DOMAINS, MATH_TOPICS };
