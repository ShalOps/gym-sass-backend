import * as crypto from 'crypto';

// Generate a 32-byte (256-bit) random key encoded as hex
// This provides a strong key for AES-256 encryption
const encryptionKey = crypto.randomBytes(32).toString('hex');

// Generate a 64-byte random secret for JWT signing
// This provides a strong secret for HS256 JWT tokens
const jwtSecret = crypto.randomBytes(64).toString('hex');

console.log('Generated ENCRYPTION_KEY:');
console.log(encryptionKey);
console.log('\nGenerated JWT_SECRET:');
console.log(jwtSecret);
console.log('\nAdd these to your .env file:');
console.log(`ENCRYPTION_KEY=${encryptionKey}`);
console.log(`JWT_SECRET=${jwtSecret}`);
