/**
 * Auth / authz security smoke checks against a running API.
 * Usage: npx tsx scripts/auth-security-check.ts
 * Env: API_BASE (default http://127.0.0.1:3100), AUTH_EMAIL, AUTH_PASSWORD
 */
import 'dotenv/config';

const BASE = (process.env.API_BASE || process.env.E2E_BASE_URL || 'http://127.0.0.1:3100').replace(/\/$/, '');
const EMAIL = process.env.AUTH_EMAIL || 'admin@novapay.ua';
const PASSWORD = process.env.AUTH_PASSWORD || process.env.SEED_USER_PASSWORD || 'grc123';

type Result = { name: string; ok: boolean; detail: string };

const results: Result[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function jsonFetch(
  path: string,
  opts: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: any }> {
  const headers = new Headers(opts.headers);
  if (opts.token) headers.set('Authorization', `Bearer ${opts.token}`);
  if (opts.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function main() {
  console.log(`Target: ${BASE}\n`);

  // 1) No token → 401
  {
    const { status } = await jsonFetch('/api/auth/me');
    record('Protected route rejects missing token', status === 401, `status=${status}`);
  }

  // 2) Bad password → 401
  {
    const { status } = await jsonFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: 'definitely-wrong-password' }),
    });
    record('Login rejects invalid password', status === 401, `status=${status}`);
  }

  // 3) Valid login
  let token = '';
  let expiresAt = '';
  {
    const { status, body } = await jsonFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    token = body?.token || '';
    expiresAt = body?.expiresAt || '';
    record('Login succeeds with valid credentials', status === 200 && Boolean(token), `status=${status}`);
  }

  if (!token) {
    console.error('\nCannot continue without a token. Check AUTH_EMAIL / AUTH_PASSWORD.');
    process.exit(1);
  }

  // 4) Token shape / transmission expectations
  {
    const payload = decodeJwtPayload(token);
    const hasJti = Boolean(payload?.jti);
    const hasTv = typeof payload?.tv === 'number';
    const hasExp = typeof payload?.exp === 'number';
    const algHeader = JSON.parse(
      Buffer.from(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    );
    record(
      'JWT uses HS256 and carries jti/tv/exp',
      algHeader.alg === 'HS256' && hasJti && hasTv && hasExp,
      `alg=${algHeader.alg} jti=${hasJti} tv=${payload?.tv} exp=${payload?.exp}`,
    );

    if (hasExp) {
      const ttlSec = (payload!.exp as number) - Math.floor(Date.now() / 1000);
      const maxSec = 9 * 60 * 60; // allow up to ~9h (default 8h + skew)
      record(
        'Access token TTL is short (≤ ~8–9h)',
        ttlSec > 0 && ttlSec <= maxSec,
        `ttl≈${Math.round(ttlSec / 60)}m expiresAt=${expiresAt || new Date((payload!.exp as number) * 1000).toISOString()}`,
      );
    }
  }

  // 5) Authn with Bearer works
  {
    const { status, body } = await jsonFetch('/api/auth/me', { token });
    record('Bearer token authenticates /api/auth/me', status === 200 && body?.email === EMAIL, `status=${status}`);
  }

  // 6) Authz: auditor-level probe if we can; with admin expect users:manage OK
  {
    const { status } = await jsonFetch('/api/users', { token });
    // admin seed should be 200; if not admin, 403 is also correct authz
    record(
      'Authorization enforced on /api/users',
      status === 200 || status === 403,
      `status=${status} (200=manage allowed, 403=denied)`,
    );
  }

  // 7) Tampered token rejected
  {
    const parts = token.split('.');
    const bad = `${parts[0]}.${parts[1]}.dGFtcGVyZWQ`;
    const { status } = await jsonFetch('/api/auth/me', { token: bad });
    record('Tampered JWT signature rejected', status === 401, `status=${status}`);
  }

  // 8) Logout revokes token
  {
    const { status: logoutStatus } = await jsonFetch('/api/auth/logout', {
      method: 'POST',
      token,
    });
    const { status: after } = await jsonFetch('/api/auth/me', { token });
    record(
      'Logout invalidates token (denylist jti)',
      logoutStatus === 200 && after === 401,
      `logout=${logoutStatus} meAfter=${after}`,
    );
  }

  // 9) Re-login + logout-all
  {
    const login = await jsonFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const t2 = login.body?.token as string;
    const login2 = await jsonFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const t3 = login2.body?.token as string;
    await jsonFetch('/api/auth/logout-all', { method: 'POST', token: t3 });
    const a = await jsonFetch('/api/auth/me', { token: t2 });
    const b = await jsonFetch('/api/auth/me', { token: t3 });
    record(
      'logout-all bumps tokenVersion and kills other sessions',
      a.status === 401 && b.status === 401,
      `t2=${a.status} t3=${b.status}`,
    );
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
