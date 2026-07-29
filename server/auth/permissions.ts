export const USER_ROLES = ['admin', 'auditor', 'approver', 'implementer', 'reviewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

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

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return PERMISSIONS[permission].includes(role);
}

export function roleLabel(role: UserRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
