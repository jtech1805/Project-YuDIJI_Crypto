import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { UserModel } from "../../../src/models/User.js";
import { requireInternalApplicationRole } from "../../../src/middlewares/requireApplicationRole.js";
import {
  ApplicationAuthorizationService,
  type ApplicationRoleAuthorityReader,
} from "../../../src/services/access/application-authorization.service.js";
import {
  canonicalizeApplicationRoles,
  resolveStoredApplicationRoles,
} from "../../../src/types/application-role.types.js";
import { AppError } from "../../../src/errors/AppError.js";

test("application roles are closed, unique, USER-based, and canonical", () => {
  assert.deepEqual(canonicalizeApplicationRoles(["ADMIN", "USER"]), [
    "USER",
    "ADMIN",
  ]);
  assert.equal(canonicalizeApplicationRoles(["USER", "USER"]), null);
  assert.equal(canonicalizeApplicationRoles(["ADMIN"]), null);
  assert.equal(canonicalizeApplicationRoles(["USER", "OWNER"]), null);
  assert.deepEqual(resolveStoredApplicationRoles(undefined), ["USER"]);
});

test("new users default to USER and persistence rejects malformed roles", async () => {
  const ordinary = new UserModel({
    email: "ordinary@example.com",
    name: "Ordinary",
    password: "password123",
  });
  assert.deepEqual(ordinary.roles, ["USER"]);
  await ordinary.validate();

  for (const roles of [[], ["ADMIN"], ["USER", "USER"], ["USER", "OWNER"]]) {
    const invalid = new UserModel({
      email: "invalid@example.com",
      password: "password123",
      roles,
    });
    await assert.rejects(invalid.validate());
  }
});

test("authorization rereads current roles and immediately observes revocation", async () => {
  let roles: unknown = ["USER", "INTERNAL"];
  const service = new ApplicationAuthorizationService({
    findRolesByUserId: async () => ({ roles }),
  });
  assert.equal(
    (await service.authorizeAnyRole("USER_ID", ["INTERNAL", "ADMIN"])).status,
    "AUTHORIZED",
  );
  roles = ["USER"];
  assert.equal(
    (await service.authorizeAnyRole("USER_ID", ["INTERNAL", "ADMIN"])).status,
    "UNAUTHORIZED",
  );
});

test("authority fails closed for missing, malformed, and failed reads", async () => {
  const decision = async (reader: ApplicationRoleAuthorityReader) =>
    new ApplicationAuthorizationService(reader).authorizeAnyRole("USER_ID", [
      "INTERNAL",
    ]);
  assert.equal(
    (await decision({ findRolesByUserId: async () => null })).status,
    "IDENTITY_NOT_FOUND",
  );
  assert.equal(
    (
      await decision({
        findRolesByUserId: async () => ({ roles: ["USER", "OWNER"] }),
      })
    ).status,
    "AUTHORITY_FAILED",
  );
  assert.equal(
    (
      await decision({
        findRolesByUserId: async () => {
          throw new Error("database secret");
        },
      })
    ).status,
    "AUTHORITY_FAILED",
  );
});

const invokeMiddleware = async (
  request: Partial<Request>,
  roles: unknown,
): Promise<{ error?: AppError; principal?: unknown }> => {
  const authorization = new ApplicationAuthorizationService({
    findRolesByUserId: async () => ({ roles }),
  });
  let error: AppError | undefined;
  await requireInternalApplicationRole(authorization)(
    request as Request,
    {} as Response,
    ((value?: unknown) => {
      if (value instanceof AppError) error = value;
    }) as NextFunction,
  );
  return {
    ...(error ? { error } : {}),
    ...(request.applicationPrincipal
      ? { principal: request.applicationPrincipal }
      : {}),
  };
};

test("middleware returns 401/403 and admits INTERNAL or ADMIN", async () => {
  assert.equal((await invokeMiddleware({}, ["USER"])).error?.statusCode, 401);
  assert.equal(
    (await invokeMiddleware({ user: { id: "U" } }, ["USER"])).error?.statusCode,
    403,
  );
  for (const roles of [
    ["USER", "INTERNAL"],
    ["USER", "ADMIN"],
    ["USER", "INTERNAL", "ADMIN"],
  ]) {
    const result = await invokeMiddleware({ user: { id: "U" } }, roles);
    assert.equal(result.error, undefined);
    assert.deepEqual((result.principal as any).roles, roles);
  }
});

test("request-controlled privilege signals cannot affect authorization", async () => {
  const request = {
    user: { id: "U", roles: ["ADMIN"] },
    headers: { "x-internal-user": "true" },
    body: { isInternal: true },
    query: { role: "ADMIN" },
  } as unknown as Partial<Request>;
  const result = await invokeMiddleware(request, ["USER"]);
  assert.equal(result.error?.statusCode, 403);
});
