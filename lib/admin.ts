const ADMIN_ROLES = new Set(["admin", "owner", "superadmin"]);

const adminEmailAllowlist = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function readRoleCandidates(publicMetadata: unknown): string[] {
  if (!publicMetadata || typeof publicMetadata !== "object") return [];

  const metadata = publicMetadata as Record<string, unknown>;
  const roleValue = metadata.role;
  const rolesValue = metadata.roles;
  const candidates: string[] = [];

  if (typeof roleValue === "string") candidates.push(roleValue);
  if (Array.isArray(rolesValue)) {
    candidates.push(
      ...rolesValue.filter((entry): entry is string => typeof entry === "string")
    );
  }

  return candidates;
}

export function isSiteAdminFromMetadata(
  publicMetadata: unknown,
  email?: string | null
): boolean {
  const roleCandidates = readRoleCandidates(publicMetadata);
  if (
    roleCandidates.some((roleName) => ADMIN_ROLES.has(roleName.toLowerCase()))
  ) {
    return true;
  }

  const normalizedEmail = email?.trim().toLowerCase() ?? "";
  return Boolean(normalizedEmail && adminEmailAllowlist.includes(normalizedEmail));
}

export function isSiteAdminEmail(email?: string | null): boolean {
  const normalizedEmail = email?.trim().toLowerCase() ?? "";
  return Boolean(normalizedEmail && adminEmailAllowlist.includes(normalizedEmail));
}
