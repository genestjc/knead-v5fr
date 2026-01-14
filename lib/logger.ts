/**
 * Environment-aware logging utility
 * - In development: logs everything
 * - In production: only logs errors and warnings, removes console.log
 * This prevents information disclosure and improves performance
 */

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * Debug/informational logs - only in development
   */
  log: isDev ? console.log.bind(console) : () => {},
  
  /**
   * Debug logs - only in development
   */
  debug: isDev ? console.log.bind(console) : () => {},
  
  /**
   * Error logs - always logged (critical issues)
   */
  error: console.error.bind(console),
  
  /**
   * Warning logs - always logged (important issues)
   */
  warn: console.warn.bind(console),
};
