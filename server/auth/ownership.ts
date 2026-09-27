/** Match control ownership by name, email, or accessList entry. */
export function userOwnsControl(
  user: { email: string; name: string } | null | undefined,
  control: { owner?: string | null; accessList?: string | unknown },
): boolean {
  if (!user) return false;
  const email = user.email.trim().toLowerCase();
  const name = user.name.trim().toLowerCase();
  const owner = String(control.owner || '').trim().toLowerCase();
  if (owner && (owner === email || owner === name)) return true;

  let list: unknown[] = [];
  if (typeof control.accessList === 'string') {
    try {
      const parsed = JSON.parse(control.accessList);
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      list = [];
    }
  } else if (Array.isArray(control.accessList)) {
    list = control.accessList;
  }

  return list.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const row = entry as { email?: unknown; role?: unknown; name?: unknown };
    const entryEmail = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
    const entryName = typeof row.name === 'string' ? row.name.trim().toLowerCase() : '';
    const role = typeof row.role === 'string' ? row.role.trim().toLowerCase() : '';
    if (entryEmail && entryEmail === email) {
      return !role || role === 'owner' || role === 'control_owner';
    }
    if (entryName && entryName === name && (!role || role === 'owner' || role === 'control_owner')) {
      return true;
    }
    return false;
  });
}

export function isControlOwnerRole(role: string | null | undefined): boolean {
  return role === 'control_owner';
}

/** True if any company assignment is control_owner (scoped actor). */
export function actsAsControlOwner(user: {
  role: string;
  companies?: Partial<Record<string, string>>;
} | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'control_owner') return true;
  const companies = user.companies || {};
  const roles = Object.values(companies);
  return roles.length > 0 && roles.every((r) => r === 'control_owner');
}
