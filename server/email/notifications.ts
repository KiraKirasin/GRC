import type { PrismaClient } from '@prisma/client';
import { appOrigin, sendMail } from './mailer.js';
import { parseCompanyAccess, type UserRole } from '../auth/permissions.js';

function wrapHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;max-width:560px">
<h2 style="margin:0 0 12px">${title}</h2>
${bodyHtml}
<p style="margin-top:24px;font-size:12px;color:#666">NovaPay GRC · <a href="${appOrigin()}">${appOrigin()}</a></p>
</body></html>`;
}

/** Resolve a control owner string (email or display name) to a user email. */
export async function resolveUserEmail(
  prisma: PrismaClient,
  ownerOrEmail: string,
): Promise<{ email: string; name: string } | null> {
  const raw = String(ownerOrEmail || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  const byEmail = await prisma.user.findFirst({
    where: { email: lower, active: true },
    select: { email: true, name: true },
  });
  if (byEmail) return byEmail;

  const byName = await prisma.user.findFirst({
    where: { name: raw, active: true },
    select: { email: true, name: true },
  });
  if (byName) return byName;

  // If it looks like an email, notify even without a user row
  if (raw.includes('@')) {
    return { email: lower, name: raw };
  }
  return null;
}

/** Active users who hold approver/admin for a company (or global admin). */
export async function findApproverEmails(
  prisma: PrismaClient,
  company: string,
): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { email: true, role: true, companies: true },
  });
  const emails: string[] = [];
  for (const u of users) {
    const access = parseCompanyAccess(u.companies, u.role);
    const companyRole = access[company] as UserRole | undefined;
    const roles = new Set<string>([u.role, ...(companyRole ? [companyRole] : [])]);
    if (roles.has('admin') || roles.has('approver')) {
      emails.push(u.email);
    }
  }
  return [...new Set(emails)];
}

export async function notifyUserCreated(opts: {
  toEmail: string;
  toName: string;
  role: string;
  companies: string[];
  createdBy?: string;
}): Promise<void> {
  const loginUrl = `${appOrigin()}/login`;
  const companyList = opts.companies.length ? opts.companies.join(', ') : '—';
  const subject = 'Your NovaPay GRC account has been created';
  const text = [
    `Hello ${opts.toName},`,
    '',
    'An account has been created for you in NovaPay GRC.',
    `Email: ${opts.toEmail}`,
    `Primary role: ${opts.role}`,
    `Companies: ${companyList}`,
    opts.createdBy ? `Created by: ${opts.createdBy}` : '',
    '',
    `Sign in: ${loginUrl}`,
    '',
    'Use the password provided by your administrator, or the “Forgot password” link on the login page.',
  ]
    .filter(Boolean)
    .join('\n');

  await sendMail({
    to: opts.toEmail,
    subject,
    text,
    html: wrapHtml(
      'Welcome to NovaPay GRC',
      `<p>Hello <strong>${opts.toName}</strong>,</p>
       <p>An account has been created for you.</p>
       <ul>
         <li><strong>Email:</strong> ${opts.toEmail}</li>
         <li><strong>Role:</strong> ${opts.role}</li>
         <li><strong>Companies:</strong> ${companyList}</li>
       </ul>
       <p><a href="${loginUrl}">Sign in to GRC</a></p>
       <p style="font-size:13px;color:#555">Use the password from your administrator, or reset it via “Forgot password”.</p>`,
    ),
  });
}

export async function notifyControlAssigned(opts: {
  toEmail: string;
  toName: string;
  controlCode: string;
  controlTitle: string;
  projectId: string;
  projectTitle: string;
  assignedBy?: string;
}): Promise<void> {
  const url = `${appOrigin()}/projects/${opts.projectId}`;
  const label = opts.controlCode
    ? `${opts.controlCode} — ${opts.controlTitle}`
    : opts.controlTitle;
  const subject = `Control assigned: ${label}`;
  const text = [
    `Hello ${opts.toName},`,
    '',
    'You have been assigned as owner of a project control.',
    `Control: ${label}`,
    `Project: ${opts.projectTitle}`,
    opts.assignedBy ? `Assigned by: ${opts.assignedBy}` : '',
    '',
    `Open: ${url}`,
  ]
    .filter(Boolean)
    .join('\n');

  await sendMail({
    to: opts.toEmail,
    subject,
    text,
    html: wrapHtml(
      'Control assigned to you',
      `<p>Hello <strong>${opts.toName}</strong>,</p>
       <p>You are now the owner of:</p>
       <p><strong>${label}</strong><br/>Project: ${opts.projectTitle}</p>
       <p><a href="${url}">Open project</a></p>`,
    ),
  });
}

export async function notifyApprovalRequested(opts: {
  to: string[];
  projectId: string;
  projectTitle: string;
  company: string;
  stage: string;
  comments?: string;
  requestedBy?: string;
  reviewerHint?: string;
}): Promise<void> {
  if (!opts.to.length) return;
  const url = `${appOrigin()}/projects/${opts.projectId}`;
  const subject = `Approval requested: ${opts.projectTitle} (${opts.stage})`;
  const text = [
    'An approval has been requested in NovaPay GRC.',
    '',
    `Project: ${opts.projectTitle}`,
    `Company: ${opts.company}`,
    `Stage: ${opts.stage}`,
    opts.reviewerHint ? `Requested reviewer: ${opts.reviewerHint}` : '',
    opts.comments ? `Comments: ${opts.comments}` : '',
    opts.requestedBy ? `Requested by: ${opts.requestedBy}` : '',
    '',
    `Review: ${url}`,
  ]
    .filter(Boolean)
    .join('\n');

  await sendMail({
    to: opts.to,
    subject,
    text,
    html: wrapHtml(
      'Approval requested',
      `<p>An approval is waiting for review.</p>
       <ul>
         <li><strong>Project:</strong> ${opts.projectTitle}</li>
         <li><strong>Company:</strong> ${opts.company}</li>
         <li><strong>Stage:</strong> ${opts.stage}</li>
         ${opts.comments ? `<li><strong>Comments:</strong> ${opts.comments}</li>` : ''}
       </ul>
       <p><a href="${url}">Open project reviews</a></p>`,
    ),
  });
}
