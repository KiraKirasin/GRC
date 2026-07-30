export const USER_ROLES = ['admin', 'auditor', 'approver', 'implementer', 'reviewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Canonical company names (must match Project.company / COMPANIES on frontend). */
export const COMPANIES = [
  'NovaPay LLC',
  'Novapay Solutions',
  'Novapay Moldova',
  'NovaPay EU UAB',
] as const;

export type CompanyName = (typeof COMPANIES)[number];

export const PERMISSIONS = {
  'app:read': ['admin', 'auditor', 'approver', 'implementer', 'reviewer'],
  'controls:write': ['admin', 'approver', 'implementer'],
  'controls:delete': ['admin', 'approver'],
  'controls:approve': ['admin', 'approver'],
  'controls:review': ['admin', 'reviewer'],
  'projects:write': ['admin', 'approver', 'implementer'],
  'projects:delete': ['admin', 'approver'],
  'project-controls:write': ['admin', 'implementer', 'approver'],
  'project-controls:review': ['admin', 'reviewer', 'approver'],
  'project-controls:attachments': ['admin', 'implementer'],
  'project-controls:approve': ['admin', 'approver'],
  'tasks:write': ['admin', 'implementer', 'approver'],
  'users:manage': ['admin'],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

/** High-level capability labels for the permissions matrix UI. */
export const ROLE_CAPABILITY_MATRIX: {
  key: string;
  admin: boolean | string;
  approver: boolean | string;
  implementer: boolean | string;
  reviewer: boolean | string;
  auditor: boolean | string;
}[] = [
  { key: 'readAll', admin: true, approver: true, implementer: true, reviewer: true, auditor: true },
  { key: 'manageUsers', admin: true, approver: false, implementer: false, reviewer: false, auditor: false },
  {
    key: 'writeDelete',
    admin: true,
    approver: 'most',
    implementer: 'createEdit',
    reviewer: 'review',
    auditor: false,
  },
];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export function isCompanyName(value: string): value is CompanyName {
  return (COMPANIES as readonly string[]).includes(value);
}

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return PERMISSIONS[permission].includes(role);
}

export function roleLabel(role: UserRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function parseCompaniesJson(raw: string | null | undefined): CompanyName[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is CompanyName => typeof c === 'string' && isCompanyName(c));
  } catch {
    return [];
  }
}

/** Admin always has all companies; others get stored selection. */
export function resolveUserCompanies(role: string, companiesJson: string | null | undefined): CompanyName[] {
  if (role === 'admin') return [...COMPANIES];
  return parseCompaniesJson(companiesJson);
}

export function normalizeCompaniesInput(role: UserRole, input: unknown): CompanyName[] {
  if (role === 'admin') return [...COMPANIES];
  if (!Array.isArray(input)) return [];
  const unique = new Set<CompanyName>();
  for (const item of input) {
    if (typeof item === 'string' && isCompanyName(item)) unique.add(item);
  }
  return [...unique];
}

export function userCanAccessCompany(role: string, companiesJson: string | null | undefined, company: string): boolean {
  return resolveUserCompanies(role, companiesJson).includes(company as CompanyName);
}
