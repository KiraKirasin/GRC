export const USER_ROLES = ['admin', 'auditor', 'approver', 'implementer', 'reviewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const COMPANIES = [
  'NovaPay LLC',
  'Novapay Solutions',
  'Novapay Moldova',
  'NovaPay EU UAB',
] as const;

export type CompanyName = (typeof COMPANIES)[number];

/** Per-company role assignment. Missing key = no access. */
export type CompanyAccessMap = Partial<Record<CompanyName, UserRole>>;

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
  'policies:write': ['admin', 'approver', 'implementer'],
  'users:manage': ['admin'],
  'audit:read': ['admin', 'auditor'],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export const ROLE_CAPABILITY_MATRIX: {
  key: 'readAll' | 'manageUsers' | 'readAudit' | 'writeDelete';
  admin: boolean | string;
  approver: boolean | string;
  implementer: boolean | string;
  reviewer: boolean | string;
  auditor: boolean | string;
}[] = [
  { key: 'readAll', admin: true, approver: true, implementer: true, reviewer: true, auditor: true },
  { key: 'manageUsers', admin: true, approver: false, implementer: false, reviewer: false, auditor: false },
  { key: 'readAudit', admin: true, approver: false, implementer: false, reviewer: false, auditor: true },
  {
    key: 'writeDelete',
    admin: true,
    approver: 'most',
    implementer: 'createEdit',
    reviewer: 'review',
    auditor: false,
  },
];

const ROLE_RANK: Record<UserRole, number> = {
  admin: 5,
  approver: 4,
  implementer: 3,
  reviewer: 2,
  auditor: 1,
};

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  /** Highest privilege among company roles (derived). */
  role: UserRole;
  /** Per-company roles. */
  companies: CompanyAccessMap;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export function isCompanyName(value: string): value is CompanyName {
  return (COMPANIES as readonly string[]).includes(value);
}

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

export function roleLabel(role: UserRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function primaryRoleFromAccess(access: CompanyAccessMap): UserRole {
  let best: UserRole | null = null;
  for (const role of Object.values(access)) {
    if (!role || !isUserRole(role)) continue;
    if (!best || ROLE_RANK[role] > ROLE_RANK[best]) best = role;
  }
  return best || 'auditor';
}

export function companyNamesFromAccess(access: CompanyAccessMap): CompanyName[] {
  return COMPANIES.filter(c => Boolean(access[c]));
}

export function roleForCompany(access: CompanyAccessMap, company: string): UserRole | null {
  if (!isCompanyName(company)) return null;
  const role = access[company];
  return role && isUserRole(role) ? role : null;
}

export function accessHasPermission(
  access: CompanyAccessMap,
  permission: Permission,
  company?: string,
): boolean {
  if (company) {
    const role = roleForCompany(access, company);
    return role ? roleHasPermission(role, permission) : false;
  }
  return Object.values(access).some(
    role => role && isUserRole(role) && roleHasPermission(role, permission),
  );
}

/** Normalize companies whether stored as map or legacy string[]. */
export function normalizeUserAccess(user: AuthUser): CompanyAccessMap {
  const raw = user.companies as unknown;
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const access: CompanyAccessMap = {};
    const fallback = isUserRole(user.role) ? user.role : 'auditor';
    for (const item of raw) {
      if (typeof item === 'string' && isCompanyName(item)) access[item] = fallback;
    }
    return access;
  }
  if (typeof raw === 'object') {
    const access: CompanyAccessMap = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (isCompanyName(key) && typeof value === 'string' && isUserRole(value)) {
        access[key] = value;
      }
    }
    return access;
  }
  return {};
}

export function userCanAccessCompany(user: AuthUser | null | undefined, company: string): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return roleForCompany(normalizeUserAccess(user), company) !== null;
}

export function userHasPermission(
  user: AuthUser | null | undefined,
  permission: Permission,
  company?: string,
): boolean {
  if (!user) return false;
  // Primary role (e.g. admin) always counts — covers stale sessions & empty maps
  if (isUserRole(user.role) && roleHasPermission(user.role, permission)) {
    if (!company) return true;
    // Company-scoped: admin still has all companies
    if (user.role === 'admin') return true;
  }
  return accessHasPermission(normalizeUserAccess(user), permission, company);
}
