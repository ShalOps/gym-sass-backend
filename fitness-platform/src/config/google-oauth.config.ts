import { registerAs } from "@nestjs/config";

export default registerAs('googleOauth', () => {

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectURI = process.env.GOOGLE_REDIRECT_URI;

  if (!clientID || !clientSecret || !redirectURI) {
    throw new Error('Missing Google OAuth environment variables!');
  }

  return {
    clientID,
    clientSecret,
    redirectURI,
  };
  
});