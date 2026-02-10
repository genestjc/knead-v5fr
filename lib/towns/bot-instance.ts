/**
 * Towns Protocol Bot Instance
 * 
 * Server-side bot singleton for managing Towns Space permissions and roles.
 * This bot is used for administrative tasks like updating role permissions.
 * 
 * NOTE: The @towns-protocol/bot package needs to be properly configured
 * with a bot private key that has admin permissions in the Towns Space.
 */

import { TownsBot } from '@towns-protocol/bot';

let botInstance: TownsBot | null = null;

/**
 * Get or create the Towns bot instance
 * 
 * The bot is initialized with a private key from environment variables.
 * This bot should have admin/owner permissions in the Towns Space.
 * 
 * @returns Towns bot instance
 * @throws Error if TOWNS_BOT_PRIVATE_KEY is not set
 */
export function getTownsBot(): TownsBot {
  if (botInstance) {
    return botInstance;
  }

  const privateKey = process.env.TOWNS_BOT_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error(
      'TOWNS_BOT_PRIVATE_KEY environment variable is not set. ' +
      'Please configure a bot private key with admin permissions in the Towns Space.'
    );
  }

  // Initialize the bot with the private key
  // The bot will use this to sign transactions and interact with the Towns Protocol
  botInstance = new TownsBot({
    privateKey,
    // Add any additional configuration as needed
  });

  return botInstance;
}

/**
 * Reset the bot instance (mainly for testing)
 */
export function resetBotInstance(): void {
  botInstance = null;
}
