/**
 * Conditional Logger - Strips sensitive data and reduces logs in production
 * 
 * Usage:
 * - logger.debug() - Only logs in development
 * - logger.info() - Logs in all environments
 * - logger.warn() - Logs warnings
 * - logger.error() - Logs errors
 * - logger.logAddress() - Safely logs wallet addresses (masked in production)
 * - logger.logTransaction() - Safely logs transaction hashes (masked in production)
 */

const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';

export const logger = {
  /**
   * Debug logs - only in development
   */
  debug: isDev ? console.log.bind(console) : () => {},

  /**
   * Info logs - all environments
   */
  info: console.log.bind(console),

  /**
   * Warning logs - all environments
   */
  warn: console.warn.bind(console),

  /**
   * Error logs - all environments
   */
  error: console.error.bind(console),

  /**
   * Safely log wallet addresses - masked in production
   */
  logAddress: (label: string, address: string) => {
    if (isDev) {
      console.log(`${label}: ${address}`);
    } else if (isProd) {
      // Only show first 6 and last 4 characters in production
      console.log(`${label}: ${address.slice(0, 6)}...${address.slice(-4)}`);
    }
  },

  /**
   * Safely log transaction hashes - masked in production
   */
  logTransaction: (label: string, txHash: string) => {
    if (isDev) {
      console.log(`${label}: ${txHash}`);
    } else if (isProd) {
      // Only show first 10 characters in production
      console.log(`${label}: ${txHash.slice(0, 10)}...`);
    }
  },
};
