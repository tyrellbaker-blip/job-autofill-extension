/**
 * Portal detection utilities
 * Detects which job application portal is being used
 */

/**
 * Detects the job portal based on hostname and DOM
 * @param {string} hostname - Current page hostname
 * @param {Document} doc - Document object
 * @returns {string|null} Portal name or null if unknown
 */
export function detectPortal(hostname, doc) {
  // Greenhouse detection
  if (hostname.includes('greenhouse.io') || hostname.includes('greenhouse')) {
    return 'greenhouse';
  }

  // Workday detection
  if (hostname.includes('workday') || hostname.includes('myworkdayjobs')) {
    return 'workday';
  }

  // Lever detection
  if (hostname.includes('lever.co') || hostname.includes('jobs.lever')) {
    return 'lever';
  }

  // Taleo detection
  if (hostname.includes('taleo.net') || hostname.includes('taleo')) {
    return 'taleo';
  }

  return null;
}