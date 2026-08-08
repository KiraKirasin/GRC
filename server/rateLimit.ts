import rateLimit from 'express-rate-limit';

/**
 * Shared limiters for FS-touching write / ZIP routes (CodeQL js/missing-rate-limiting).
 * Download routes use an inline rateLimit() next to res.download / createReadStream
 * so CodeQL reliably treats them as guarded.
 */

/** Full evidence ZIP build (heavier I/O / CPU). */
export const evidencePackageLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many evidence package downloads. Please try again later.' },
});

/** Attachment upload / delete (write + unlink). */
export const attachmentWriteLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attachment changes. Please try again later.' },
});
