/**
 * Centralized payment configuration for the application
 * Handles Chapa payment gateway configuration with environment-based settings
 */

export interface ChapaConfig {
  secretKey: string;
  webhookSecret?: string;
}

/**
 * Get Chapa payment gateway configuration
 * Automatically selects test or production secret key based on environment
 */
export const getChapaConfig = (): ChapaConfig => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Select appropriate secret key based on environment
  const secretKey = isProduction
    ? process.env.CHAPA_SECRET_KEY // Production key
    : process.env.CHAPA_TEST_SECRET_KEY; // Test key for development

  if (!secretKey) {
    throw new Error(
      `Chapa secret key not configured. Please set ${
        isProduction ? 'CHAPA_SECRET_KEY' : 'CHAPA_TEST_SECRET_KEY'
      } environment variable.`,
    );
  }

  const config: ChapaConfig = {
    secretKey,
  };

  // Add webhook secret if configured
  const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET;
  if (webhookSecret) {
    config.webhookSecret = webhookSecret;
  }

  return config;
};

/**
 * Get Chapa configuration for module registration
 * Returns the configuration object expected by ChapaModule.registerAsync
 */
export const getChapaModuleConfig = () => {
  return getChapaConfig();
};
