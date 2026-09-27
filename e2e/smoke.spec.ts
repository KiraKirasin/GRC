import { expect, test } from '@playwright/test';

const E2E_EMAIL = process.env.E2E_EMAIL || 'admin@novapay.ua';
const E2E_PASSWORD = process.env.E2E_PASSWORD || process.env.SEED_USER_PASSWORD || 'grc123';

test.describe('API smoke', () => {
  test('health endpoint responds', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toMatchObject({ ok: true });
  });

  test('protected route rejects anonymous access', async ({ request }) => {
    const response = await request.get('/api/auth/me');
    expect(response.status()).toBe(401);
  });
});

test.describe('App shell', () => {
  test('login page loads without demo account shortcuts', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    // Demo seed buttons must not appear on the login screen
    await expect(page.getByText(/demo accounts/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^admin$/i })).toHaveCount(0);
  });

  test('root redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Authentication', () => {
  test('rejects invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(E2E_EMAIL);
    await page.locator('input[type="password"]').fill('wrong-password-xyz');
    await page.getByRole('button', { name: /sign in|увійти|вхід/i }).click();
    await expect(page.getByText(/invalid|невірний|failed|невдал/i)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('signs in with seed admin and reaches app', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(E2E_EMAIL);
    await page.locator('input[type="password"]').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: /sign in|увійти|вхід/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.locator('body')).toBeVisible();
  });
});
