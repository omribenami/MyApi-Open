'use strict';

/**
 * Returns true if the password meets the minimum strength requirements:
 * at least 8 characters and at least 3 of: uppercase, lowercase, number, symbol.
 */
function isStrongPassword(pw) {
  if (!pw || pw.length < 8) return false;
  const hasUpperCase  = /[A-Z]/.test(pw);
  const hasLowerCase  = /[a-z]/.test(pw);
  const hasNumbers    = /\d/.test(pw);
  const hasNonalphas  = /\W/.test(pw);
  const score = [hasUpperCase, hasLowerCase, hasNumbers, hasNonalphas].filter(Boolean).length;
  return score >= 3;
}

module.exports = { isStrongPassword };
