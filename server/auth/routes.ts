import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { signToken } from './jwt.js';
import {
  companyNamesFromAccess,
  normalizeCompanyAccessInput,
  parseCompanyAccess,
  primaryRoleFromAccess,
  serializeCompanyAccess,
  accessHasPermission,
  roleHasPermission,
  PERMISSIONS,
  type CompanyAccessMap,
  type Permission,
  type UserRole,
} from './permissions.js';
import { requirePermission } from './middleware.js';
import { auditFromRequest, computeChanges, writeAuditLog, clientMeta } from '../audit.js';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashResetToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function effectivePermissions(role: UserRole, companies: CompanyAccessMap): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter(
    (p) => roleHasPermission(role, p) || accessHasPermission(companies, p),
  );
}

function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  companies?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  const companies = parseCompanyAccess(user.companies, user.role);
  const role = primaryRoleFromAccess(companies);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    companies,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function registerAuthRoutes(app: Express, prisma: PrismaClient) {
  app.post('/api/auth/login', async (req, res) => {
    const meta = clientMeta(req);
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.active) {
        await writeAuditLog(prisma, {
          category: 'security',
          action: 'login_failed',
          severity: 'warning',
          success: false,
          actorEmail: email,
          entityType: 'session',
          entityLabel: email,
          summary: `Failed login attempt for ${email} (user not found or inactive)`,
          ...meta,
        });
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        await writeAuditLog(prisma, {
          category: 'security',
          action: 'login_failed',
          severity: 'warning',
          success: false,
          actorId: user.id,
          actorEmail: user.email,
          actorName: user.name,
          actorRole: user.role,
          entityType: 'session',
          entityId: user.id,
          entityLabel: user.email,
          summary: `Failed login attempt for ${user.email} (invalid password)`,
          ...meta,
        });
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const companies = parseCompanyAccess(user.companies, user.role);
      if (companyNamesFromAccess(companies).length === 0) {
        return res.status(403).json({ error: 'No company access assigned' });
      }
      const role = primaryRoleFromAccess(companies);

      // Keep stored primary role in sync with company access
      if (user.role !== role || user.companies !== serializeCompanyAccess(companies)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role, companies: serializeCompanyAccess(companies) },
        });
      }

      const token = signToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        role,
        companies,
      });

      await writeAuditLog(prisma, {
        category: 'security',
        action: 'login',
        severity: 'info',
        success: true,
        actorId: user.id,
        actorEmail: user.email,
        actorName: user.name,
        actorRole: role,
        entityType: 'session',
        entityId: user.id,
        entityLabel: user.email,
        summary: `${user.name} signed in`,
        metadata: { companies },
        ...meta,
      });

      res.json({
        token,
        user: serializeUser({ ...user, role, companies: serializeCompanyAccess(companies) }),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      if (req.user) {
        await auditFromRequest(prisma, req, {
          category: 'security',
          action: 'logout',
          entityType: 'session',
          entityId: req.user.id,
          entityLabel: req.user.email,
          summary: `${req.user.name} signed out`,
        });
      }
      res.json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  app.get('/api/auth/me', async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || !user.active) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }
      res.json(serializeUser(user));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to load user' });
    }
  });

  app.get('/api/auth/permissions', (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const permissions = effectivePermissions(req.user.role, req.user.companies);
    res.json({
      role: req.user.role,
      companies: req.user.companies,
      permissions,
    });
  });

  app.post('/api/auth/change-password', async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    try {
      const currentPassword = String(req.body.currentPassword || '');
      const newPassword = String(req.body.newPassword || '');
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new password are required' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      if (currentPassword === newPassword) {
        return res.status(400).json({ error: 'New password must be different from current password' });
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || !user.active) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        await auditFromRequest(prisma, req, {
          category: 'security',
          action: 'password_change_failed',
          severity: 'warning',
          success: false,
          entityType: 'user',
          entityId: user.id,
          entityLabel: user.email,
          summary: `Failed password change for ${user.email} (invalid current password)`,
        });
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      await auditFromRequest(prisma, req, {
        category: 'security',
        action: 'password_change',
        severity: 'warning',
        entityType: 'user',
        entityId: user.id,
        entityLabel: user.email,
        summary: `Password changed for ${user.email}`,
      });

      res.json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    const meta = clientMeta(req);
    const email = String(req.body.email || '').trim().toLowerCase();
    const generic = {
      ok: true,
      message: 'If an account exists for that email, a reset link has been issued.',
    };

    try {
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.active) {
        await writeAuditLog(prisma, {
          category: 'security',
          action: 'password_reset_request',
          severity: 'info',
          success: true,
          actorEmail: email,
          entityType: 'user',
          entityLabel: email,
          summary: `Password reset requested for unknown/inactive email ${email}`,
          ...meta,
        });
        return res.json(generic);
      }

      // Invalidate previous unused tokens for this user
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });

      const rawToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(rawToken),
          expiresAt,
        },
      });

      const appOrigin = String(process.env.APP_ORIGIN || 'http://localhost:5200').replace(/\/$/, '');
      const resetUrl = `${appOrigin}/reset-password?token=${rawToken}`;
      console.info(`[auth] Password reset link for ${user.email}: ${resetUrl}`);

      await writeAuditLog(prisma, {
        category: 'security',
        action: 'password_reset_request',
        severity: 'warning',
        actorId: user.id,
        actorEmail: user.email,
        actorName: user.name,
        actorRole: user.role,
        entityType: 'user',
        entityId: user.id,
        entityLabel: user.email,
        summary: `Password reset token issued for ${user.email} (expires ${expiresAt.toISOString()})`,
        ...meta,
      });

      const expose =
        process.env.AUTH_EXPOSE_RESET_URL === 'true' ||
        process.env.NODE_ENV !== 'production';

      res.json({
        ...generic,
        ...(expose ? { resetUrl, expiresAt: expiresAt.toISOString() } : {}),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to process password reset request' });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const meta = clientMeta(req);
    try {
      const token = String(req.body.token || '').trim();
      const newPassword = String(req.body.newPassword || '');
      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const tokenHash = hashResetToken(token);
      const record = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
        await writeAuditLog(prisma, {
          category: 'security',
          action: 'password_reset_failed',
          severity: 'warning',
          success: false,
          entityType: 'user',
          summary: 'Password reset failed (invalid or expired token)',
          ...meta,
        });
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      if (!record.user.active) {
        return res.status(400).json({ error: 'User account is inactive' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await prisma.$transaction([
        prisma.user.update({
          where: { id: record.userId },
          data: { passwordHash },
        }),
        prisma.passwordResetToken.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        }),
        prisma.passwordResetToken.deleteMany({
          where: { userId: record.userId, usedAt: null, id: { not: record.id } },
        }),
      ]);

      await writeAuditLog(prisma, {
        category: 'security',
        action: 'password_reset',
        severity: 'warning',
        actorId: record.user.id,
        actorEmail: record.user.email,
        actorName: record.user.name,
        actorRole: record.user.role,
        entityType: 'user',
        entityId: record.user.id,
        entityLabel: record.user.email,
        summary: `Password reset completed for ${record.user.email}`,
        ...meta,
      });

      res.json({ ok: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  });

  app.get('/api/users', requirePermission('users:manage'), async (_req, res) => {
    try {
      const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
      res.json(users.map(serializeUser));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to load users' });
    }
  });

  app.post('/api/users', requirePermission('users:manage'), async (req, res) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const name = String(req.body.name || '').trim();
      const password = String(req.body.password || '');

      if (!email || !name || !password) {
        return res.status(400).json({ error: 'Email, name, and password are required' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const companies = normalizeCompanyAccessInput(req.body.companies);
      if (companyNamesFromAccess(companies).length === 0) {
        return res.status(400).json({ error: 'Assign a role for at least one company' });
      }
      const role = primaryRoleFromAccess(companies);

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          role,
          companies: serializeCompanyAccess(companies),
        },
      });

      await auditFromRequest(prisma, req, {
        category: 'security',
        action: 'create',
        severity: 'warning',
        entityType: 'user',
        entityId: user.id,
        entityLabel: user.email,
        summary: `Created user ${user.name} (${user.email}) with company roles`,
        changes: {
          email: { from: null, to: user.email },
          name: { from: null, to: user.name },
          role: { from: null, to: role },
          companies: { from: null, to: companies },
        },
      });

      res.status(201).json(serializeUser(user));
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        return res.status(409).json({ error: 'Email already exists' });
      }
      console.error(error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  app.patch('/api/users/:id', requirePermission('users:manage'), async (req, res) => {
    try {
      const body = req.body;
      const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'User not found' });

      const beforeAccess = parseCompanyAccess(existing.companies, existing.role);
      const data: {
        name?: string;
        role?: string;
        active?: boolean;
        passwordHash?: string;
        companies?: string;
      } = {};

      if (body.name !== undefined) data.name = String(body.name).trim();
      if (body.active !== undefined) data.active = Boolean(body.active);

      let nextAccess: CompanyAccessMap = beforeAccess;
      if (body.companies !== undefined) {
        nextAccess = normalizeCompanyAccessInput(body.companies);
        if (companyNamesFromAccess(nextAccess).length === 0) {
          return res.status(400).json({ error: 'Assign a role for at least one company' });
        }
        data.companies = serializeCompanyAccess(nextAccess);
        data.role = primaryRoleFromAccess(nextAccess);
      } else if (body.role !== undefined) {
        // Legacy: single role applied to all currently assigned companies
        const role = String(body.role) as UserRole;
        if (!USER_ROLES.includes(role)) {
          return res.status(400).json({ error: `Role must be one of: ${USER_ROLES.join(', ')}` });
        }
        const names = companyNamesFromAccess(beforeAccess);
        nextAccess = Object.fromEntries(names.map(c => [c, role])) as CompanyAccessMap;
        data.companies = serializeCompanyAccess(nextAccess);
        data.role = role;
      }

      let passwordChanged = false;
      if (body.password) {
        const password = String(body.password);
        if (password.length < 6) {
          return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        data.passwordHash = await bcrypt.hash(password, 10);
        passwordChanged = true;
      }

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data,
      });

      const afterAccess = parseCompanyAccess(user.companies, user.role);
      await auditFromRequest(prisma, req, {
        category: 'security',
        action: 'update',
        severity: passwordChanged || body.companies !== undefined || body.active === false ? 'warning' : 'info',
        entityType: 'user',
        entityId: user.id,
        entityLabel: user.email,
        summary: `Updated user ${user.name} (${user.email})`,
        changes: computeChanges(
          {
            name: existing.name,
            role: existing.role,
            active: existing.active,
            companies: beforeAccess,
            password: false,
          },
          {
            name: user.name,
            role: user.role,
            active: user.active,
            companies: afterAccess,
            password: passwordChanged,
          },
        ),
        metadata: passwordChanged ? { passwordChanged: true } : undefined,
      });

      res.json(serializeUser(user));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });
}
