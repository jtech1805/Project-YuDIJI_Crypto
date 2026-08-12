import bcrypt from "bcrypt";
import {
  model,
  Schema,
  type HydratedDocument,
  type InferSchemaType,
} from "mongoose";
import { APPLICATION_ROLES } from "../types/application-role.types.js";

const SALT_ROUNDS = 10;

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    refreshToken: {
      type: String,
      required: false,
      default: null,
    },
    roles: {
      type: [String],
      enum: APPLICATION_ROLES,
      default: (): string[] => ["USER"],
      validate: {
        validator: (roles: readonly string[]): boolean =>
          roles.length > 0 &&
          roles.includes("USER") &&
          new Set(roles).size === roles.length,
        message:
          "Application roles must be unique, non-empty, and include USER",
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.pre("save", function canonicalizeRoles(): void {
  if (Array.isArray(this.roles)) {
    this.roles = APPLICATION_ROLES.filter((role) => this.roles.includes(role));
  }
});

userSchema.pre("save", async function hashPassword(): Promise<void> {
  const userDocument = this as HydratedDocument<User>;

  if (!userDocument.isModified("password")) {
    return;
  }

  const hashedPassword = await bcrypt.hash(userDocument.password, SALT_ROUNDS);
  userDocument.password = hashedPassword;
});

export type User = InferSchemaType<typeof userSchema>;

export const UserModel = model<User>("User", userSchema);
