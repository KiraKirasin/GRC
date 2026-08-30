import crypto from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { CompanyAccessMap, UserRole } from './permissions.js';

const JWT_SECRET = process.env.JWT_SECRET || 'grc-dev-secret-change-in-production';
/** Default 8h — short-lived access tokens; override via JWT_EXPIRES (e.g. 1h, 15m) */
const JWT_EXPIRES = (process.env.JWT_EXPIRES || '8h') as SignOptions['expiresIn'];

export interface AuthTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  /** Per-company roles map. */
  companies: CompanyAccessMap;
  /** Unique token id for revocation (logout). */
  jti: string;
  /** Must match User.tokenVersion — bumped to invalidate all sessions. */
  tv: number;
}

export function getJwtExpiresIn(): string {
  return String(JWT_EXPIRES);
}

export function signToken(
  payload: Omit<AuthTokenPayload, 'jti'> & { jti?: string },
): { token: string; jti: string; expiresAt: Date } {
  const jti = payload.jti || crypto.randomUUID();
  const token = jwt.sign(
    {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      companies: payload.companies,
      jti,
      tv: payload.tv,
    },
    JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: JWT_EXPIRES,
    },
  );

  const decoded = jwt.decode(token) as { exp?: number } | null;
  const expiresAt = decoded?.exp
    ? new Date(decoded.exp * 1000)
    : new Date(Date.now() + 8 * 60 * 60 * 1000);

  return { token, jti, expiresAt };
}

export function verifyToken(token: string): (AuthTokenPayload & { exp?: number }) | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    }) as AuthTokenPayload & { exp?: number; jti?: string };
    const jti = payload.jti || (payload as { jti?: string }).jti;
    if (!payload.sub || !jti) return null;
    return { ...payload, jti };
  } catch {
    return null;
  }
}

export function decodeTokenUnsafe(token: string): (AuthTokenPayload & { exp?: number }) | null {
  try {
    const payload = jwt.decode(token) as (AuthTokenPayload & { exp?: number }) | null;
    if (!payload?.sub) return null;
    return payload;
  } catch {
    return null;
  }
}
