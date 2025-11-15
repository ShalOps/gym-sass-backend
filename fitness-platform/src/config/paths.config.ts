import { resolve } from 'path';

/**
 * Centralized path configuration for file uploads
 * Uses absolute paths to ensure consistency across all environments
 */

// Relative paths from environment
export const UPLOADS_DIR_RELATIVE = process.env.UPLOADS_DIR || './uploads';
export const THUMBNAIL_DIR_RELATIVE =
  process.env.THUMBNAIL_DIR || './uploads/thumbnails';

// Absolute paths (resolved once for consistency)
export const UPLOADS_DIR_ABSOLUTE = resolve(UPLOADS_DIR_RELATIVE);
export const THUMBNAIL_DIR_ABSOLUTE = resolve(THUMBNAIL_DIR_RELATIVE);

// Web prefixes for API responses
export const UPLOADS_WEB_PREFIX = '/uploads/';
export const THUMBNAIL_WEB_PREFIX = '/uploads/thumbnails/';
