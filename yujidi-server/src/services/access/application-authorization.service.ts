import { UserModel } from "../../models/User.js";
import type {
  ApplicationAuthorizationDecision,
  ApplicationRole,
} from "../../types/application-role.types.js";
import { resolveStoredApplicationRoles } from "../../types/application-role.types.js";

export type ApplicationRoleAuthorityReader = Readonly<{
  findRolesByUserId(
    userId: string,
  ): Promise<Readonly<{ roles?: unknown }> | null>;
}>;

const userRoleAuthorityReader: ApplicationRoleAuthorityReader = {
  findRolesByUserId: async (userId) => {
    const user = await UserModel.findById(userId)
      .select({ roles: 1 })
      .lean()
      .exec();
    return user ? { roles: user.roles } : null;
  },
};

export class ApplicationAuthorizationService {
  public constructor(
    private readonly authority: ApplicationRoleAuthorityReader = userRoleAuthorityReader,
  ) {}

  public async authorizeAnyRole(
    userId: string,
    allowedRoles: readonly ApplicationRole[],
  ): Promise<ApplicationAuthorizationDecision> {
    try {
      const stored = await this.authority.findRolesByUserId(userId);
      if (!stored) return Object.freeze({ status: "IDENTITY_NOT_FOUND" });

      const roles = resolveStoredApplicationRoles(stored.roles);
      if (!roles) return Object.freeze({ status: "AUTHORITY_FAILED" });

      if (!allowedRoles.some((role) => roles.includes(role))) {
        return Object.freeze({ status: "UNAUTHORIZED" });
      }

      return Object.freeze({
        status: "AUTHORIZED",
        principal: Object.freeze({ userId, roles }),
      });
    } catch {
      return Object.freeze({ status: "AUTHORITY_FAILED" });
    }
  }
}
