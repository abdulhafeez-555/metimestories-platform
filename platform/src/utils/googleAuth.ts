import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  fullName: string;
  picture: string | null;
}

// Verifies a Google ID token server-side (never trust a token's claims
// without this — anyone could send a fake payload claiming to be
// someone else). Throws if the token is invalid, expired, or wasn't
// issued for this app's own Client ID.
export async function verifyGoogleToken(idToken: string): Promise<GoogleProfile> {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error('Invalid Google token payload');
  }

  const fullName = payload.name || '';
  const firstName = payload.given_name || fullName.split(' ')[0] || 'Author';
  const lastName = payload.family_name || fullName.split(' ').slice(1).join(' ') || 'User';

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: !!payload.email_verified,
    firstName,
    lastName,
    fullName: fullName || `${firstName} ${lastName}`,
    picture: payload.picture || null,
  };
}
