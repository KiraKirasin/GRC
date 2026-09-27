import type { PrismaClient } from '@prisma/client';

/** Persist JWT `jti` so logout / early revoke rejects the token until natural expiry. */
export async function revokeTokenJti(
  prisma: PrismaClient,
  opts: { jti: string; userId: string; expiresAt: Date },
): Promise<void> {
  await prisma.revokedToken.upsert({
    where: { jti: opts.jti },
    create: {
      jti: opts.jti,
      userId: opts.userId,
      expiresAt: opts.expiresAt,
    },
    update: {
      expiresAt: opts.expiresAt,
    },
  });
  // Opportunistic cleanup of expired denylist rows
  await prisma.revokedToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

export async function isTokenRevoked(prisma: PrismaClient, jti: string): Promise<boolean> {
  const row = await prisma.revokedToken.findUnique({
    where: { jti },
    select: { expiresAt: true },
  });
  if (!row) return false;
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.revokedToken.delete({ where: { jti } }).catch(() => undefined);
    return false;
  }
  return true;
}

/** Invalidate every outstanding JWT for the user (password change, disable, force logout). */
export async function bumpTokenVersion(prisma: PrismaClient, userId: string): Promise<number> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });
  await prisma.revokedToken.deleteMany({ where: { userId } });
  return updated.tokenVersion;
}
