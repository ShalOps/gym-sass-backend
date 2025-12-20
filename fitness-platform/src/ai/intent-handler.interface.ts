export interface IntentData {
  userId: string;
  message: string;
  conversationId?: string;
  userTier?: string;
  // Use UserContextService for profile data; don't add fields here.
}

export interface IntentHandler {
  handle(data: IntentData): Promise<string>;
}
