/**
 * @file Conditional logging utility
 * @description Logs only in development mode to prevent information leakage in production
 */

const isDev = import.meta.env.DEV;

/**
 * Conditional console.log - only logs in development
 * @param {...any} args - Arguments to log
 */
export const log = (...args) => {
  if (isDev) {
    console.log(...args);
  }
};

/**
 * Conditional console.error - only logs in development
 * @param {...any} args - Arguments to log
 */
export const error = (...args) => {
  if (isDev) {
    console.error(...args);
  }
};

/**
 * Conditional console.warn - only logs in development
 * @param {...any} args - Arguments to log
 */
export const warn = (...args) => {
  if (isDev) {
    console.warn(...args);
  }
};

/**
 * Conditional console.info - only logs in development
 * @param {...any} args - Arguments to log
 */
export const info = (...args) => {
  if (isDev) {
    console.info(...args);
  }
};

/**
 * Always log errors (even in production) for error tracking
 * Use this for critical errors that need to be tracked
 * @param {Error} error - Error object
 * @param {string} context - Context where error occurred
 */
export const logError = (error, context = '') => {
  // In production, this could send to error tracking service (Sentry, etc.)
  console.error(`[${context}]`, error);

  // TODO: Send to error tracking service in production
  // if (!isDev) {
  //   Sentry.captureException(error, { tags: { context } });
  // }
};

export default { log, error, warn, info, logError };
