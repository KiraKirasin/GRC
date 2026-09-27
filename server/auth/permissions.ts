export const USER_ROLES = [
  'admin',
  'auditor',
  'approver',
  'implementer',
  'reviewer',
  'control_owner',
  'app_manager',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Canonical company names (must match Project.company / COMPANIES on frontend). */
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
  'app:read': ['admin', 'auditor', 'approver', 'implementer', 'reviewer', 'control_owner', 'app_manager'],
  'controls:write': ['admin', 'approver', 'implementer'],
  'controls:delete': ['admin', 'approver'],
  'controls:approve': ['admin', 'approver'],
  'controls:review': ['admin', 'reviewer'],
  'projects:write': ['admin', 'approver', 'implementer'],
  'projects:delete': ['admin', 'approver'],
  'project-controls:write': ['admin', 'implementer', 'approver', 'control_owner'],
  'project-controls:review': ['admin', 'reviewer', 'approver'],
  'project-controls:attachments': ['admin', 'implementer', 'control_owner'],
  'project-controls:approve': ['admin', 'approver'],
  'tasks:write': ['admin', 'implementer', 'approver'],
  'policies:write': ['admin', 'approver', 'implementer'],
  'systems-registry:read': ['admin', 'auditor', 'approver', 'implementer', 'reviewer', 'control_owner', 'app_manager'],
  'systems-registry:write': ['admin', 'app_manager'],
  'systems-registry:link': ['admin', 'app_manager', 'approver', 'auditor', 'implementer', 'control_owner'],
  'users:manage': ['admin'],
  'email-templates:read': ['admin'],
  'email-templates:write': ['admin'],
  'audit:read': ['admin', 'auditor'],
  'copilot:use': ['admin'],
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
  control_owner: boolean | string;
  app_manager: boolean | string;
}[] = [
  {
    key: 'readAll',
    admin: true,
    approver: true,
    implementer: true,
    reviewer: true,
    auditor: true,
    control_owner: 'ownControls',
    app_manager: true,
  },
  {
    key: 'manageUsers',
    admin: true,
    approver: false,
    implementer: false,
    reviewer: false,
    auditor: false,
    control_owner: false,
    app_manager: false,
  },
  {
    key: 'readAudit',
    admin: true,
    approver: false,
    implementer: false,
    reviewer: false,
    auditor: true,
    control_owner: false,
    app_manager: false,
  },
  {
    key: 'writeDelete',
    admin: true,
    approver: 'most',
    implementer: 'createEdit',
    reviewer: 'review',
    auditor: false,
    control_owner: 'ownControlsEdit',
    app_manager: 'systemsRegistry',
  },
];

const ROLE_RANK: Record<UserRole, number> = {
  admin: 7,
  approver: 6,
  app_manager: 5,
  implementer: 4,
  reviewer: 3,
  auditor: 2,
  control_owner: 1,
};

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
  return role
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Highest-privilege role among company assignments (for JWT primary role / display). */
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

/**
 * Permission check:
 * - with company → use that company's role
 * - without company → true if any assigned company role grants it
 */
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

/**
 * Parse stored JSON.
 * Supports:
 * - new: { "NovaPay LLC": "admin", ... }
 * - legacy: ["NovaPay LLC", ...] (+ optional fallbackRole for each)
 */
export function parseCompanyAccess(
  raw: string | null | undefined,
  fallbackRole?: string,
): CompanyAccessMap {
  try {
    const parsed = JSON.parse(raw || '{}');
    const access: CompanyAccessMap = {};

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (isCompanyName(key) && typeof value === 'string' && isUserRole(value)) {
          access[key] = value;
        }
      }
      return access;
    }

    if (Array.isArray(parsed)) {
      const role =
        fallbackRole && isUserRole(fallbackRole) ? fallbackRole : ('auditor' as UserRole);
      for (const item of parsed) {
        if (typeof item === 'string' && isCompanyName(item)) {
          access[item] = role;
        } else if (item && typeof item === 'object') {
          const company = (item as { company?: unknown }).company;
          const itemRole = (item as { role?: unknown }).role;
          if (
            typeof company === 'string' &&
            isCompanyName(company) &&
            typeof itemRole === 'string' &&
            isUserRole(itemRole)
          ) {
            access[company] = itemRole;
          }
        }
      }
      return access;
    }
  } catch {
    /* ignore */
  }
  return {};
}

/** Normalize API input into a CompanyAccessMap. */
export function normalizeCompanyAccessInput(input: unknown): CompanyAccessMap {
  const access: CompanyAccessMap = {};
  if (!input || typeof input !== 'object') return access;

  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === 'string' && isCompanyName(item)) {
        access[item] = 'auditor';
      } else if (item && typeof item === 'object') {
        const company = (item as { company?: unknown }).company;
        const role = (item as { role?: unknown }).role;
        if (
          typeof company === 'string' &&
          isCompanyName(company) &&
          typeof role === 'string' &&
          isUserRole(role)
        ) {
          access[company] = role;
        }
      }
    }
    return access;
  }

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (isCompanyName(key) && typeof value === 'string' && isUserRole(value)) {
      access[key] = value;
    }
  }
  return access;
}

export function serializeCompanyAccess(access: CompanyAccessMap): string {
  const clean: CompanyAccessMap = {};
  for (const company of COMPANIES) {
    const role = access[company];
    if (role && isUserRole(role)) clean[company] = role;
  }
  return JSON.stringify(clean);
}

/** @deprecated Prefer parseCompanyAccess — kept for gradual migration call sites */
export function resolveUserCompanies(
  role: string,
  companiesJson: string | null | undefined,
): CompanyName[] {
  return companyNamesFromAccess(parseCompanyAccess(companiesJson, role));
}

export function userCanAccessCompany(
  role: string,
  companiesJson: string | null | undefined,
  company: string,
): boolean {
  return roleForCompany(parseCompanyAccess(companiesJson, role), company) !== null;
}

/** Can user link IS Registry entries into a project scope (any registry company)? */
export function canLinkRegistryToProject(
  user: { role: string; companies: CompanyAccessMap },
  projectCompany: string,
): boolean {
  if (isUserRole(user.role) && user.role === 'admin') return true;
  const companies = user.companies || {};
  return (
    accessHasPermission(companies, 'systems-registry:link', projectCompany) ||
    accessHasPermission(companies, 'projects:write', projectCompany) ||
    accessHasPermission(companies, 'project-controls:write', projectCompany)
  );
}
