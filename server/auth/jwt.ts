import jwt, { type SignOptions } from 'jsonwebtoken';
import type { CompanyAccessMap, UserRole } from './permissions.js';

const JWT_SECRET = process.env.JWT_SECRET || 'grc-dev-secret-change-in-production';
const JWT_EXPIRES = (process.env.JWT_EXPIRES || '7d') as SignOptions['expiresIn'];

export interface AuthTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  /** Per-company roles map. */
  companies: CompanyAccessMap;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}
