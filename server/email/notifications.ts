import type { PrismaClient } from '@prisma/client';
import { appOrigin, sendMail } from './mailer.js';
import { parseCompanyAccess, type UserRole } from '../auth/permissions.js';
import { sendTemplatedMail } from './templates.js';

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
  prisma: PrismaClient;
  toEmail: string;
  toName: string;
  role: string;
  companies: string[];
  createdBy?: string;
}): Promise<void> {
  const companyList = opts.companies.length ? opts.companies.join(', ') : '—';
  await sendTemplatedMail(opts.prisma, 'user_created', opts.toEmail, {
    toName: opts.toName,
    toEmail: opts.toEmail,
    role: opts.role,
    companies: companyList,
    createdBy: opts.createdBy,
    loginUrl: `${appOrigin()}/login`,
  });
}

export async function notifyControlAssigned(opts: {
  prisma: PrismaClient;
  toEmail: string;
  toName: string;
  controlCode: string;
  controlTitle: string;
  projectId: string;
  projectTitle: string;
  assignedBy?: string;
}): Promise<void> {
  const label = opts.controlCode
    ? `${opts.controlCode} — ${opts.controlTitle}`
    : opts.controlTitle;
  await sendTemplatedMail(opts.prisma, 'control_assigned', opts.toEmail, {
    toName: opts.toName,
    control: label,
    projectTitle: opts.projectTitle,
    projectUrl: `${appOrigin()}/projects/${opts.projectId}`,
    assignedBy: opts.assignedBy,
  });
}

export async function notifySystemUpdateAssigned(opts: {
  prisma: PrismaClient;
  toEmail: string;
  toName: string;
  systemName: string;
  systemId: string;
}): Promise<void> {
  await sendTemplatedMail(opts.prisma, 'system_update_assigned', opts.toEmail, {
    toName: opts.toName,
    systemName: opts.systemName,
    systemUrl: `${appOrigin()}/systems-registry?system=${opts.systemId}`,
  });
}

export async function notifyTaskAssigned(opts: {
  prisma: PrismaClient;
  toEmail: string;
  toName: string;
  taskTitle: string;
  taskDescription?: string;
  dueDate?: string;
  taskUrl?: string;
}): Promise<void> {
  await sendTemplatedMail(opts.prisma, 'task_assigned', opts.toEmail, {
    toName: opts.toName,
    taskTitle: opts.taskTitle,
    taskDescription: opts.taskDescription || '',
    dueDate: opts.dueDate || '—',
    taskUrl: opts.taskUrl || `${appOrigin()}/tasks`,
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
