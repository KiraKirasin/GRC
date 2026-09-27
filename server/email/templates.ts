import type { PrismaClient } from '@prisma/client';
import { appOrigin, sendMail } from './mailer.js';

export const EMAIL_PROCESSES = [
  'user_created',
  'control_assigned',
  'system_update_assigned',
  'task_assigned',
] as const;

export type EmailProcess = (typeof EMAIL_PROCESSES)[number];
export type EmailLocale = 'uk' | 'en' | 'ru';
export type TemplateVars = Record<string, string | number | undefined>;

const defaults: Record<EmailProcess, Record<EmailLocale, { name: string; subject: string; bodyText: string; bodyHtml: string }>> = {
  user_created: {
    uk: { name: 'Новий користувач', subject: 'Вас додано до NovaPay GRC', bodyText: 'Вітаємо, {{toName}}!\n\nВаш обліковий запис створено в NovaPay GRC.\nEmail: {{toEmail}}\nКомпанії: {{companies}}\n\nУвійти: {{loginUrl}}', bodyHtml: '<p>Вітаємо, <strong>{{toName}}</strong>!</p><p>Ваш обліковий запис створено в NovaPay GRC.</p><p>Email: {{toEmail}}<br>Компанії: {{companies}}</p><p><a href="{{loginUrl}}">Увійти до GRC</a></p>' },
    en: { name: 'New user welcome', subject: 'You were added to NovaPay GRC', bodyText: 'Hello, {{toName}}!\n\nYour account was created in NovaPay GRC.\nEmail: {{toEmail}}\nCompanies: {{companies}}\n\nSign in: {{loginUrl}}', bodyHtml: '<p>Hello, <strong>{{toName}}</strong>!</p><p>Your account was created in NovaPay GRC.</p><p>Email: {{toEmail}}<br>Companies: {{companies}}</p><p><a href="{{loginUrl}}">Sign in to GRC</a></p>' },
    ru: { name: 'Приветствие нового пользователя', subject: 'Вас добавили в NovaPay GRC', bodyText: 'Здравствуйте, {{toName}}!\n\nВаш аккаунт создан в NovaPay GRC.\nEmail: {{toEmail}}\nКомпании: {{companies}}\n\nВойти: {{loginUrl}}', bodyHtml: '<p>Здравствуйте, <strong>{{toName}}</strong>!</p><p>Ваш аккаунт создан в NovaPay GRC.</p><p>Email: {{toEmail}}<br>Компании: {{companies}}</p><p><a href="{{loginUrl}}">Войти в GRC</a></p>' },
  },
  control_assigned: {
    uk: { name: 'Призначення власника контролю', subject: 'Вам призначено контроль: {{control}}', bodyText: 'Вітаємо, {{toName}}!\n\nВам призначено контроль {{control}} у проєкті {{projectTitle}}.\n\nВідкрити: {{projectUrl}}', bodyHtml: '<p>Вітаємо, <strong>{{toName}}</strong>!</p><p>Вам призначено контроль <strong>{{control}}</strong> у проєкті <strong>{{projectTitle}}</strong>.</p><p><a href="{{projectUrl}}">Відкрити проєкт</a></p>' },
    en: { name: 'Control assignment', subject: 'Control assigned: {{control}}', bodyText: 'Hello, {{toName}}!\n\nYou were assigned control {{control}} in project {{projectTitle}}.\n\nOpen: {{projectUrl}}', bodyHtml: '<p>Hello, <strong>{{toName}}</strong>!</p><p>You were assigned control <strong>{{control}}</strong> in project <strong>{{projectTitle}}</strong>.</p><p><a href="{{projectUrl}}">Open project</a></p>' },
    ru: { name: 'Назначение владельца контроля', subject: 'Вам назначен контроль: {{control}}', bodyText: 'Здравствуйте, {{toName}}!\n\nВам назначен контроль {{control}} в проекте {{projectTitle}}.\n\nОткрыть: {{projectUrl}}', bodyHtml: '<p>Здравствуйте, <strong>{{toName}}</strong>!</p><p>Вам назначен контроль <strong>{{control}}</strong> в проекте <strong>{{projectTitle}}</strong>.</p><p><a href="{{projectUrl}}">Открыть проект</a></p>' },
  },
  system_update_assigned: {
    uk: { name: 'Оновлення системи', subject: 'Потрібно оновити інформацію про систему {{systemName}}', bodyText: 'Вітаємо, {{toName}}!\n\nВам призначено оновлення інформації про систему {{systemName}}.\n\nВідкрити: {{systemUrl}}', bodyHtml: '<p>Вітаємо, <strong>{{toName}}</strong>!</p><p>Потрібно оновити інформацію про систему <strong>{{systemName}}</strong>.</p><p><a href="{{systemUrl}}">Відкрити систему</a></p>' },
    en: { name: 'System update assignment', subject: 'System information update required: {{systemName}}', bodyText: 'Hello, {{toName}}!\n\nYou were assigned to update information for system {{systemName}}.\n\nOpen: {{systemUrl}}', bodyHtml: '<p>Hello, <strong>{{toName}}</strong>!</p><p>You were assigned to update information for <strong>{{systemName}}</strong>.</p><p><a href="{{systemUrl}}">Open system</a></p>' },
    ru: { name: 'Обновление системы', subject: 'Нужно обновить информацию о системе {{systemName}}', bodyText: 'Здравствуйте, {{toName}}!\n\nВам назначено обновление информации о системе {{systemName}}.\n\nОткрыть: {{systemUrl}}', bodyHtml: '<p>Здравствуйте, <strong>{{toName}}</strong>!</p><p>Нужно обновить информацию о системе <strong>{{systemName}}</strong>.</p><p><a href="{{systemUrl}}">Открыть систему</a></p>' },
  },
  task_assigned: {
    uk: { name: 'Призначення задачі', subject: 'Вам призначено задачу: {{taskTitle}}', bodyText: 'Вітаємо, {{toName}}!\n\nВам призначено задачу: {{taskTitle}}.\nОпис: {{taskDescription}}\nТермін: {{dueDate}}\n\nВідкрити: {{taskUrl}}', bodyHtml: '<p>Вітаємо, <strong>{{toName}}</strong>!</p><p>Вам призначено задачу: <strong>{{taskTitle}}</strong>.</p><p>{{taskDescription}}<br>Термін: {{dueDate}}</p><p><a href="{{taskUrl}}">Відкрити задачу</a></p>' },
    en: { name: 'Task assignment', subject: 'Task assigned: {{taskTitle}}', bodyText: 'Hello, {{toName}}!\n\nYou were assigned task: {{taskTitle}}.\nDescription: {{taskDescription}}\nDue date: {{dueDate}}\n\nOpen: {{taskUrl}}', bodyHtml: '<p>Hello, <strong>{{toName}}</strong>!</p><p>You were assigned task: <strong>{{taskTitle}}</strong>.</p><p>{{taskDescription}}<br>Due date: {{dueDate}}</p><p><a href="{{taskUrl}}">Open task</a></p>' },
    ru: { name: 'Назначение задачи', subject: 'Вам назначена задача: {{taskTitle}}', bodyText: 'Здравствуйте, {{toName}}!\n\nВам назначена задача: {{taskTitle}}.\nОписание: {{taskDescription}}\nСрок: {{dueDate}}\n\nОткрыть: {{taskUrl}}', bodyHtml: '<p>Здравствуйте, <strong>{{toName}}</strong>!</p><p>Вам назначена задача: <strong>{{taskTitle}}</strong>.</p><p>{{taskDescription}}<br>Срок: {{dueDate}}</p><p><a href="{{taskUrl}}">Открыть задачу</a></p>' },
  },
};

function render(value: string, vars: TemplateVars): string {
  return value.replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (_match, key: string) => String(vars[key] ?? ''));
}

export function templateDefaults(process: EmailProcess) {
  return Object.entries(defaults[process]).map(([locale, value]) => ({ process, locale, ...value, enabled: true }));
}

export async function sendTemplatedMail(
  prisma: PrismaClient,
  process: EmailProcess,
  to: string | string[],
  vars: TemplateVars,
  locale: EmailLocale = 'uk',
): Promise<void> {
  const row = await prisma.emailTemplate.findFirst({ where: { process, locale, enabled: true } });
  const fallback = defaults[process][locale] || defaults[process].uk;
  const template = row || fallback;
  const subject = render(template.subject, vars);
  const text = render(template.bodyText, vars);
  const html = render(template.bodyHtml || `<pre>${text}</pre>`, vars);
  await sendMail({ to, subject, text, html });
}

export function defaultTemplateRows() {
  return EMAIL_PROCESSES.flatMap(templateDefaults);
}

export function processLabel(process: EmailProcess): string {
  return {
    user_created: 'New user added',
    control_assigned: 'Control assigned',
    system_update_assigned: 'System update assigned',
    task_assigned: 'Task assigned',
  }[process];
}

export const templateAppOrigin = appOrigin;
