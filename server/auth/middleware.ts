import type { NextFunction, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { verifyToken } from './jwt.js';
import { isTokenRevoked } from './tokens.js';
import {
  type CompanyAccessMap,
  type Permission,
  accessHasPermission,
  isUserRole,
  parseCompanyAccess,
  primaryRoleFromAccess,
  roleHasPermission,
} from './permissions.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: import('./permissions.js').UserRole;
  companies: CompanyAccessMap;
  /** JWT id — used for logout revocation */
  jti?: string;
  /** JWT exp (unix seconds) */
  exp?: number;
  tokenVersion?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      rawBearerToken?: string;
    }
  }
}

const PUBLIC_PATHS = new Set([
  '/api/health',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]);

function normalizeTokenCompanies(
  role: string,
  companies: unknown,
): CompanyAccessMap {
  if (companies && typeof companies === 'object' && !Array.isArray(companies)) {
    return parseCompanyAccess(JSON.stringify(companies), role);
  }
  if (Array.isArray(companies)) {
    return parseCompanyAccess(JSON.stringify(companies), role);
  }
  return {};
}

export function createAuthenticateUnlessPublic(prisma: PrismaClient) {
  return async function authenticateUnlessPublic(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const pathname = (req.originalUrl || req.url || req.path).split('?')[0];
    if (!pathname.startsWith('/api') || PUBLIC_PATHS.has(pathname) || PUBLIC_PATHS.has(req.path)) {
      next();
      return;
    }

    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    try {
      if (await isTokenRevoked(prisma, payload.jti)) {
        res.status(401).json({ error: 'Token has been revoked' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, active: true, tokenVersion: true },
      });
      if (!user || !user.active) {
        res.status(401).json({ error: 'User not found or inactive' });
        return;
      }
      const tokenTv = typeof payload.tv === 'number' ? payload.tv : 0;
      if (tokenTv !== user.tokenVersion) {
        res.status(401).json({ error: 'Token has been revoked' });
        return;
      }

      const companies = normalizeTokenCompanies(payload.role, payload.companies);
      const role = isUserRole(payload.role) ? payload.role : primaryRoleFromAccess(companies);

      req.rawBearerToken = token;
      req.user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role,
        companies,
        jti: payload.jti,
        exp: payload.exp,
        tokenVersion: user.tokenVersion,
      };
      next();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  };
}

/** @deprecated Prefer createAuthenticateUnlessPublic(prisma) — kept only if something imports name */
export const authenticateUnlessPublic = (
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  res.status(500).json({ error: 'Auth middleware not initialized' });
};

export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const allowed = permissions.some(
      (p) =>
        accessHasPermission(req.user!.companies, p) ||
        roleHasPermission(req.user!.role, p),
    );
    if (!allowed) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
