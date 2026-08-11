export {};

import type { AuthenticatedApplicationPrincipal } from "../application-role.types.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
      applicationPrincipal?: AuthenticatedApplicationPrincipal;
    }
  }
}
