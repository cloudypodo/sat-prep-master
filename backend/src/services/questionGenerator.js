import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert SAT question writer with deep knowledge of College Board's SAT format, difficulty levels, and scoring. Generate authentic-format but drastically harder practice questions — this is intentional, extreme difficulty calibration, not a real SAT.

DIFFICULTY CALIBRATION (critical — pushed far beyond the real exam):
- "easy" requested → generate at real SAT "hard" difficulty
- "medium" requested → generate at real SAT's hardest (top 5%) difficulty
- "hard" requested → beyond anything College Board has ever published — competition/olympiad-adjacent difficulty, the hardest questions you can construct while staying within the format
Every question should require multiple layered reasoning steps, not just one extra step. Distractors must be extremely subtle — plausible under a superficial read, and wrong only for a precise, easy-to-miss reason. The goal is that the real SAT would feel drastically easier by comparison; a strong student should still need to work hard for every point.

MAXIMIZE CONFUSION, NOT AMBIGUITY (critical): every question must still have exactly one rigorously correct, well-defined answer reachable by careful work — never make a question broken, contradictory, or genuinely ambiguous. Within that constraint, actively make questions harder to parse and easier to trip up on:
- Write dense, multi-clause stems that bury the actual question in qualifying conditions, so the reader must hold several constraints in mind at once.
- Overload notation and variable names deliberately (reuse similar-looking symbols/letters for different quantities within a single question where it stays technically unambiguous) so careless readers conflate them.
- Front-load irrelevant-seeming information or a red-herring number that a careless solver might use, while burying the detail that actually matters for the setup.
- Prefer answer choices that are "near-miss" results of the most common one- or two-step errors (sign flip, off-by-one, wrong order of operations, forgetting a constraint) rather than randomly spread values — every wrong option should represent a real, specific way a rushed student would arrive at it.
- Where the format allows, phrase the question so the final step is easy to forget (e.g., solving for an intermediate variable when the question asks for a different, related quantity).

VOCABULARY (Reading & Writing — critical):
Use sophisticated, low-frequency, Latinate/academic vocabulary throughout passages, question stems, and especially answer options — the register of GRE/graduate-level vocabulary lists, not typical SAT word lists. Favor precise, uncommon words over common synonyms. For "Words in Context" and similar vocabulary-driven questions, make multiple answer options near-synonyms of each other so the student must draw a fine semantic distinction to find the single best fit.

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
  algebra_2: ['Polynomial Functions & Division', 'Rational Functions & Expressions', 'Exponential & Logarithmic Functions', 'Complex Numbers', 'Sequences & Series', 'Matrices'],
  precalculus: ['Trigonometric Functions & Identities', 'Unit Circle & Radians', 'Conic Sections', 'Vectors', 'Polar Coordinates', 'Function Inverses & Compositions'],
  calculus: ['Limits & Continuity', 'Derivatives & Rates of Change', 'Applications of Derivatives', 'Integrals & Area Under Curves', 'Fundamental Theorem of Calculus'],
  geometry_2: ['Coordinate Geometry & Conic Sections', 'Solid Geometry & 3D Volume', 'Circle Theorems & Arc Relationships', '3D Coordinate Geometry', 'Geometric Proofs & Similarity'],
  trigonometry: ['Law of Sines & Cosines', 'Trigonometric Graphs & Transformations', 'Trigonometric Equations', 'Sum & Difference Formulas', 'Double & Half-Angle Formulas', 'Inverse Trigonometric Functions'],
  integrated: ['Algebra + Geometry Integration', 'Calculus + Algebra Integration', 'Trigonometry + Functions Integration', 'Statistics + Advanced Algebra Integration'],
};

function buildRWPrompt(count, difficulty, topics) {
  const topicList = topics.join(', ');
  return `Generate ${count} SAT Reading & Writing questions.

Specifications:
- Topics/Skills: ${topicList}
- Difficulty: ${difficulty} (apply the extreme calibration and vocabulary requirements from the system prompt)
- Format: ALL must be multiple_choice with exactly 4 options (A, B, C, D)
- Reading passages: include a passage (60–130 words) whenever the skill is reading-based (Central Ideas, Command of Evidence, Inferences, Words in Context, Text Structure, Cross-Text Connections, Rhetorical Synthesis, Transitions). Grammar/conventions questions (Boundaries, Form Structure Sense) do NOT need a passage — just a sentence or short paragraph with a blank or underline.
- Push passage vocabulary and syntax to a dense, academic register (think literary criticism, scientific journals, or scholarly essays) — avoid plain, everyday phrasing wherever a more precise or advanced word fits.

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
- Difficulty: ${difficulty} (apply the extreme calibration from the system prompt)
- Multiple choice: exactly 4 options (A, B, C, D)
- Grid-in: the student produces a numeric answer. Answer must be a POSITIVE number (integer, decimal, or fraction). No negatives, consistent with real SAT grid-in rules. Include equivalent accepted forms when relevant (e.g., "1/2" and "0.5" and ".5" for the same value).

HARD MATH REQUIREMENTS (apply especially to Advanced Math, Problem-Solving & Data Analysis, and Geometry & Trigonometry topics):
- Combine two or more skills in a single question (e.g., a system that requires factoring before substitution, a geometry problem that folds in a rate or percent, a function question requiring composition or transformation before evaluation).
- Require at least 3 distinct reasoning/calculation steps to reach the answer — no single-step plug-ins.
- Use deliberately messy or non-round numbers, and structures that resist shortcutting or answer-choice back-substitution.
- For Problem-Solving & Data Analysis: favor questions requiring careful interpretation of a described data set, statistical nuance (e.g., effect of outliers on mean vs. median, sampling/inference caveats), or multi-step unit conversions — not direct formula lookups.
- For Advanced Math: favor nonlinear systems, composed/transformed functions, and equivalent-expression manipulation requiring several algebraic moves.
- For Geometry & Trigonometry: favor multi-figure or multi-step problems combining area/volume, angle relationships, and trig ratios rather than single-formula lookups.
- For Algebra 2: favor polynomial factoring/division requiring the remainder or factor theorem, log/exponential equations requiring change-of-base or multiple exponent properties in sequence, and complex-number arithmetic requiring several operations before simplifying.
- For Precalculus: favor trig identity manipulation requiring 2+ identities chained together, function composition/inverse chains, and conic-section problems requiring algebraic derivation of a property (focus, vertex, asymptote) rather than a lookup.
- For Trigonometry: favor Law of Sines/Cosines problems with ambiguous-case setups, equations requiring a sum/difference or double/half-angle identity BEFORE solving, graph transformations requiring reading amplitude/period/phase-shift simultaneously, and inverse-trig questions requiring domain/range restriction awareness — never a single-identity lookup.
- For Calculus: use precise derivative/integral notation and require correct application of the chain, product, or quotient rule, or an optimization/related-rates setup with a real-world framing — never a bare power-rule plug-in. Assume the student knows standard derivative/integral rules for polynomials, trig, exponential, and log functions.
- For Geometry 2: favor coordinate-geometry problems requiring derivation (not lookup) of circle/conic equations, 3D solids requiring two or more formulas in sequence (e.g., a cone inscribed in a cylinder), and circle-theorem chains requiring multiple angle/arc relationships.
- For Integrated Math topics: the question MUST require crossing two or more distinct domains in a single solution path (e.g., a related-rates calculus problem embedded in a 3D geometric solid, a trig identity combined with a quadratic, a statistics question requiring log/exponential modeling) — do not just relabel a single-domain question.
- Grid-in answers must always be POSITIVE regardless of topic — for Calculus/Precalculus/Geometry 2 especially, design the question so the natural correct answer is positive (e.g., ask for a magnitude, area, or absolute value) rather than a signed quantity that could land negative.

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

// Cycles through `topics` starting at `offset`, wrapping around — used so
// consecutive batches actually rotate across the full topic pool instead of
// every batch requesting the same leading slice.
function pickBatchTopics(topics, offset, size) {
  if (topics.length <= size) return topics;
  const picked = [];
  for (let i = 0; i < size; i++) {
    picked.push(topics[(offset + i) % topics.length]);
  }
  return picked;
}

// Generate questions in batches to stay within token limits
const BATCH_SIZE = 9;

const RW_TOPIC_WINDOW = 3;

export async function generateRWQuestions({ count, difficulty = 'medium', topics = [] }) {
  const resolvedTopics = selectTopics('rw', topics);
  const randomStart = Math.floor(Math.random() * resolvedTopics.length);
  const allQuestions = [];
  let remaining = count;
  let batchIndex = 0;

  while (remaining > 0) {
    const batchCount = Math.min(BATCH_SIZE, remaining);
    // Rotate topics through batches for variety, starting from a random point per call
    const batchTopics = pickBatchTopics(resolvedTopics, randomStart + batchIndex * RW_TOPIC_WINDOW, RW_TOPIC_WINDOW);
    const prompt = buildRWPrompt(batchCount, difficulty, batchTopics);
    const batch = await callClaude(prompt);
    allQuestions.push(...batch.slice(0, batchCount));
    remaining -= batchCount;
    batchIndex++;
  }

  return allQuestions.slice(0, count);
}

const MATH_TOPIC_WINDOW = 5;

export async function generateMathQuestions({ count, difficulty = 'medium', topics = [] }) {
  const resolvedTopics = selectTopics('math', topics);
  const randomStart = Math.floor(Math.random() * resolvedTopics.length);

  // Maintain ~75% MC, ~25% grid-in ratio per real SAT
  const gridInCount = Math.round(count * 0.25);
  const mcCount = count - gridInCount;

  const allQuestions = [];
  let mcRemaining = mcCount;
  let gridRemaining = gridInCount;
  let batchIndex = 0;

  while (mcRemaining > 0 || gridRemaining > 0) {
    const batchMC = Math.min(Math.ceil(BATCH_SIZE * 0.75), mcRemaining);
    const batchGrid = Math.min(BATCH_SIZE - batchMC, gridRemaining);
    // Rotate topics through batches for variety, starting from a random point per call
    const batchTopics = pickBatchTopics(resolvedTopics, randomStart + batchIndex * MATH_TOPIC_WINDOW, MATH_TOPIC_WINDOW);
    const prompt = buildMathPrompt(batchMC, batchGrid, difficulty, batchTopics);
    const batch = await callClaude(prompt);

    // Separate by type since Claude puts MC first per our prompt
    const batchMCQs = batch.filter(q => q.question_type === 'multiple_choice').slice(0, batchMC);
    const batchGridQs = batch.filter(q => q.question_type === 'grid_in').slice(0, batchGrid);
    allQuestions.push(...batchMCQs, ...batchGridQs);

    mcRemaining -= batchMCQs.length;
    gridRemaining -= batchGridQs.length;
    batchIndex++;

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
