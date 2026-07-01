// SAT Score Conversion Service
//
// NOTE: These lookup tables are approximations modeled on College Board's published
// raw-to-scaled score conversion charts (available in the SAT Student Score Report
// documentation and Bluebook practice test answer keys). The exact internal curve
// varies slightly from test to test and is not fully public. This implementation
// captures the real test's non-linear shape: near-perfect scores lose very little
// per missed question, the middle of the range costs more per miss, and the bottom
// flattens toward the 200-point floor.
//
// R&W: 54 raw questions → 200–800 scaled
// Math: 44 raw questions → 200–800 scaled

const RW_SCORE_TABLE = {
  0: 200, 1: 200, 2: 210, 3: 220, 4: 230, 5: 240,
  6: 250, 7: 260, 8: 270, 9: 280, 10: 290,
  11: 300, 12: 310, 13: 320, 14: 330, 15: 340,
  16: 350, 17: 360, 18: 380, 19: 390, 20: 400,
  21: 410, 22: 420, 23: 430, 24: 440, 25: 450,
  26: 460, 27: 470, 28: 480, 29: 490, 30: 500,
  31: 510, 32: 520, 33: 530, 34: 540, 35: 550,
  36: 560, 37: 570, 38: 580, 39: 590, 40: 600,
  41: 610, 42: 620, 43: 640, 44: 650, 45: 660,
  46: 670, 47: 690, 48: 700, 49: 720, 50: 730,
  51: 750, 52: 760, 53: 780, 54: 800,
};

const MATH_SCORE_TABLE = {
  0: 200, 1: 200, 2: 210, 3: 220, 4: 240, 5: 260,
  6: 280, 7: 300, 8: 320, 9: 340, 10: 360,
  11: 380, 12: 400, 13: 410, 14: 430, 15: 450,
  16: 460, 17: 480, 18: 490, 19: 510, 20: 520,
  21: 530, 22: 540, 23: 560, 24: 570, 25: 590,
  26: 600, 27: 610, 28: 630, 29: 640, 30: 660,
  31: 670, 32: 690, 33: 700, 34: 710, 35: 720,
  36: 730, 37: 740, 38: 750, 39: 760, 40: 770,
  41: 780, 42: 790, 43: 795, 44: 800,
};

// Difficulty adjustment: our questions are calibrated ~1 tier harder than the real SAT.
// We apply a small bonus to the adjusted raw score to give users a realistic estimate
// of what they'd score on the actual exam. The bonus is ~10% of total possible questions.
const RW_DIFFICULTY_BONUS = 5;   // out of 54 possible
const MATH_DIFFICULTY_BONUS = 4;  // out of 44 possible

export function calculateScaledScore(rawScore, section, applyAdjustment = true) {
  let adjusted = rawScore;

  if (applyAdjustment) {
    if (section === 'rw') {
      adjusted = Math.min(54, rawScore + RW_DIFFICULTY_BONUS);
    } else if (section === 'math') {
      adjusted = Math.min(44, rawScore + MATH_DIFFICULTY_BONUS);
    }
  }

  const table = section === 'rw' ? RW_SCORE_TABLE : MATH_SCORE_TABLE;
  const maxRaw = section === 'rw' ? 54 : 44;

  adjusted = Math.max(0, Math.min(maxRaw, adjusted));
  return table[adjusted] ?? 200;
}

export function calculateTestScores(rwRaw, mathRaw) {
  const rwScaled = calculateScaledScore(rwRaw, 'rw');
  const mathScaled = calculateScaledScore(mathRaw, 'math');
  return {
    rwScaled,
    mathScaled,
    total: rwScaled + mathScaled,
  };
}

export function getPercentile(totalScore) {
  // Approximate percentile ranks based on College Board 2023 data
  if (totalScore >= 1550) return 99;
  if (totalScore >= 1500) return 98;
  if (totalScore >= 1450) return 96;
  if (totalScore >= 1400) return 94;
  if (totalScore >= 1350) return 91;
  if (totalScore >= 1300) return 87;
  if (totalScore >= 1250) return 82;
  if (totalScore >= 1200) return 76;
  if (totalScore >= 1150) return 70;
  if (totalScore >= 1100) return 62;
  if (totalScore >= 1050) return 54;
  if (totalScore >= 1000) return 46;
  if (totalScore >= 950) return 38;
  if (totalScore >= 900) return 30;
  if (totalScore >= 850) return 23;
  if (totalScore >= 800) return 17;
  if (totalScore >= 750) return 11;
  if (totalScore >= 700) return 7;
  if (totalScore >= 650) return 4;
  if (totalScore >= 600) return 2;
  return 1;
}
