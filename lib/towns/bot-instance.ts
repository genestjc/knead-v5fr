/**
 * Towns Protocol Bot Instance
 * 
 * Server-side bot singleton for managing Towns Space permissions and roles.
 * This bot is used for administrative tasks like updating role permissions.
 * 
 * NOTE: The @towns-protocol/bot package needs to be properly configured
 * with a bot private key that has admin permissions in the Towns Space.
 */

import { makeTownsBot, type Bot } from '@towns-protocol/bot';

let botInstance: Bot | null = null;

/**
 * Get or create the Towns bot instance
 * 
 * The bot is initialized with a private key from environment variables.
 * This bot should have admin/owner permissions in the Towns Space.
 * 
 * @returns Towns bot instance
 * @throws Error if TOWNS_BOT_PRIVATE_KEY is not set
 */
export async function getTownsBot(): Promise<Bot> {
  if (botInstance) {
    return botInstance;
  }

  const privateKey = process.env.TOWNS_BOT_PRIVATE_KEY;
  const jwtSecret = process.env.TOWNS_BOT_JWT_SECRET;
  
  if (!privateKey) {
    throw new Error(
      'TOWNS_BOT_PRIVATE_KEY environment variable is not set. ' +
      'Please configure a bot private key with admin permissions in the Towns Space.'
    );
  }

  if (!jwtSecret) {
    throw new Error(
      'TOWNS_BOT_JWT_SECRET environment variable is not set. ' +
      'Please configure a JWT secret for the bot.'
    );
  }

  // Initialize the bot with the private key
  // The bot will use this to sign transactions and interact with the Towns Protocol
  botInstance = await makeTownsBot(privateKey, jwtSecret);

  return botInstance;
}

/**
 * Reset the bot instance (mainly for testing)
 */
export function resetBotInstance(): void {
  botInstance = null;
}
