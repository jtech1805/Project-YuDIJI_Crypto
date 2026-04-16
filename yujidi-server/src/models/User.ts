import bcrypt from "bcrypt";
import { model, Schema, type HydratedDocument, type InferSchemaType } from "mongoose";

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
    name:{
     type:String
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
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

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
