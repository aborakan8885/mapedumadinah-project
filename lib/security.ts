/**
 * Defensive Programming Utilities
 */

/**
 * Sanitizes strings to prevent basic XSS when rendering user-provided content.
 * Although React handles most XSS, this adds a layer of defense for edge cases
 * and database storage.
 */
export const sanitizeString = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/[<>]/g, '') // Remove basic tags
    .trim()
    .substring(0, 5000); // Prevent extreme payload sizes
};

/**
 * Validates phone numbers to ensure they follow a safe pattern.
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[0-9+\-\s()]*$/;
  return phoneRegex.test(phone) && phone.length <= 20;
};
