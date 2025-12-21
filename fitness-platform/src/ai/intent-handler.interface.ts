/**
 * Data structure for AI intent processing.
 * Note: Profile data should be retrieved via UserContextService.
 * @property {string} userId - User identifier
 * @property {string} message - User's message text
 * @property {string} [conversationId] - Optional conversation identifier
 * @property {string} [userTier] - Reserved for future tier-based features
 */
export interface IntentData {
  userId: string;
  message: string;
  conversationId?: string;
  userTier?: string;
}

/**
 * Interface for AI intent handlers.
 * @method handle - Processes intent data and returns response
 * @param {IntentData} data - The intent data to process
 * @returns {Promise<string>} Response string
 */
export interface IntentHandler {
  handle(data: IntentData): Promise<string>;
}
