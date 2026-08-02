import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from './jwt.js';
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
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
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

export function authenticateUnlessPublic(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith('/api') || PUBLIC_PATHS.has(req.path)) {
    next();
    return;
  }

  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  const companies = normalizeTokenCompanies(payload.role, payload.companies);
  const role = isUserRole(payload.role) ? payload.role : primaryRoleFromAccess(companies);

  req.user = {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    role,
    companies,
  };
  next();
}

export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const allowed = permissions.some(
      p =>
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
