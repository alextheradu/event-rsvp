import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'dev-fallback-secret-change-in-production',
);

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  isAllowed: boolean;
  slackId: string | null;
}

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.id as string,
      name: payload.name as string,
      email: payload.email as string,
      avatarUrl: (payload.avatarUrl as string) || null,
      isAllowed: payload.isAllowed as boolean,
      slackId: (payload.slackId as string) || null,
    };
  } catch {
    return null;
  }
}
