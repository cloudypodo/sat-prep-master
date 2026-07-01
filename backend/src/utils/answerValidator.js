// Grid-in answer validation following real SAT rules:
// - Positive numbers only (integers, decimals, fractions)
// - Accepts equivalent forms: 1/2 == 0.5 == .5
// - Tolerance of 0.001 for decimal equivalence (truncation/rounding allowed)

export function validateGridIn(userAnswer, correctAnswer, acceptedAnswers = []) {
  if (!userAnswer || userAnswer.trim() === '') return false;

  const toNumber = (str) => {
    str = String(str).trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length !== 2) return NaN;
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (den === 0) return NaN;
      return num / den;
    }
    return parseFloat(str);
  };

  const userVal = toNumber(userAnswer);
  if (isNaN(userVal)) return false;

  // Check against main correct answer
  const correctVal = toNumber(correctAnswer);
  if (!isNaN(correctVal) && Math.abs(userVal - correctVal) <= 0.001) return true;

  // Check against accepted equivalent answers
  if (acceptedAnswers && acceptedAnswers.length > 0) {
    for (const alt of acceptedAnswers) {
      const altVal = toNumber(alt);
      if (!isNaN(altVal) && Math.abs(userVal - altVal) <= 0.001) return true;
    }
  }

  return false;
}

export function validateMultipleChoice(userAnswer, correctAnswer) {
  return String(userAnswer).trim().toUpperCase() === String(correctAnswer).trim().toUpperCase();
}
