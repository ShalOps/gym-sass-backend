export interface IntentData {
  userId: string;
  message: string;
  conversationId?: string;
  userTier?: string;
  // add more fields as needed (user profile, preferences)
}

export interface IntentHandler {
  handle(data: IntentData): Promise<string>;
}
