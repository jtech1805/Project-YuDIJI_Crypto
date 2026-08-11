export const APPLICATION_ROLES = ["USER", "INTERNAL", "ADMIN"] as const;

export type ApplicationRole = (typeof APPLICATION_ROLES)[number];

export type AuthenticatedApplicationPrincipal = Readonly<{
  userId: string;
  roles: readonly ApplicationRole[];
}>;

export type ApplicationAuthorizationDecision =
  | Readonly<{
      status: "AUTHORIZED";
      principal: AuthenticatedApplicationPrincipal;
    }>
  | Readonly<{
      status: "UNAUTHORIZED" | "IDENTITY_NOT_FOUND" | "AUTHORITY_FAILED";
    }>;

const APPLICATION_ROLE_SET = new Set<string>(APPLICATION_ROLES);

export const canonicalizeApplicationRoles = (
  value: unknown,
): readonly ApplicationRole[] | null => {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (
    value.some(
      (role) => typeof role !== "string" || !APPLICATION_ROLE_SET.has(role),
    ) ||
    new Set(value).size !== value.length ||
    !value.includes("USER")
  ) {
    return null;
  }

  return Object.freeze(
    APPLICATION_ROLES.filter((role) => value.includes(role)),
  );
};

export const resolveStoredApplicationRoles = (
  value: unknown,
): readonly ApplicationRole[] | null =>
  value === undefined || value === null
    ? Object.freeze(["USER"] as const)
    : canonicalizeApplicationRoles(value);
