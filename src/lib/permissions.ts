export const USER_ROLES = ['admin', 'auditor', 'approver', 'implementer', 'reviewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

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

export const ROLE_CAPABILITY_MATRIX: {
  key: 'readAll' | 'manageUsers' | 'writeDelete';
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

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companies: CompanyName[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

export function roleLabel(role: UserRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function userCanAccessCompany(user: AuthUser | null | undefined, company: string): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.companies.includes(company as CompanyName);
}
