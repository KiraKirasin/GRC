import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { signToken } from './jwt.js';
import {
  COMPANIES,
  isUserRole,
  normalizeCompaniesInput,
  resolveUserCompanies,
  USER_ROLES,
  type UserRole,
} from './permissions.js';
import { requirePermission } from './middleware.js';

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
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companies: resolveUserCompanies(user.role, user.companies),
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function registerAuthRoutes(app: Express, prisma: PrismaClient) {
  app.post('/api/auth/login', async (req, res) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.active) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (!isUserRole(user.role)) {
        return res.status(500).json({ error: 'User has invalid role' });
      }

      const companies = resolveUserCompanies(user.role, user.companies);
      const token = signToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companies,
      });

      res.json({
        token,
        user: serializeUser(user),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Login failed' });
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
    res.json({ role: req.user.role, companies: req.user.companies });
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
      const role = String(req.body.role || 'auditor') as UserRole;

      if (!email || !name || !password) {
        return res.status(400).json({ error: 'Email, name, and password are required' });
      }
      if (!isUserRole(role)) {
        return res.status(400).json({ error: `Role must be one of: ${USER_ROLES.join(', ')}` });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      const companies = normalizeCompaniesInput(role, req.body.companies);
      if (role !== 'admin' && companies.length === 0) {
        return res.status(400).json({ error: 'Select at least one company' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          role,
          companies: JSON.stringify(role === 'admin' ? [...COMPANIES] : companies),
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

      const data: {
        name?: string;
        role?: string;
        active?: boolean;
        passwordHash?: string;
        companies?: string;
      } = {};

      if (body.name !== undefined) data.name = String(body.name).trim();
      if (body.active !== undefined) data.active = Boolean(body.active);

      let nextRole = existing.role as UserRole;
      if (body.role !== undefined) {
        const role = String(body.role);
        if (!isUserRole(role)) {
          return res.status(400).json({ error: `Role must be one of: ${USER_ROLES.join(', ')}` });
        }
        data.role = role;
        nextRole = role;
      }

      if (body.companies !== undefined || body.role !== undefined) {
        const companies = normalizeCompaniesInput(
          nextRole,
          body.companies !== undefined ? body.companies : JSON.parse(existing.companies || '[]'),
        );
        if (nextRole !== 'admin' && companies.length === 0) {
          return res.status(400).json({ error: 'Select at least one company' });
        }
        data.companies = JSON.stringify(nextRole === 'admin' ? [...COMPANIES] : companies);
      }

      if (body.password) {
        const password = String(body.password);
        if (password.length < 6) {
          return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        data.passwordHash = await bcrypt.hash(password, 10);
      }

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data,
      });
      res.json(serializeUser(user));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });
}
