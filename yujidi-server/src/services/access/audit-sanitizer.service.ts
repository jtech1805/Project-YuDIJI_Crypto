const REDACTED_VALUE = "[REDACTED]";

const SENSITIVE_KEY_PARTS = [
  "password",
  "token",
  "accesstoken",
  "refreshtoken",
  "feedtoken",
  "jwt",
  "cookie",
  "authorization",
  "apikey",
  "apisecret",
  "secret",
  "pin",
  "totp",
  "otp",
  "session",
  "sessiontoken",
  "clientsecret",
];

const normalizeKey = (key: string): string => {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export class AuditSanitizerService {
  public sanitize<T>(value: T): T {
    return this.sanitizeValue(value) as T;
  }

  private sanitizeValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item));
    }

    if (value instanceof Date) {
      return value;
    }

    if (!isPlainObject(value)) {
      return value;
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      sanitized[key] = this.isSensitiveKey(key)
        ? REDACTED_VALUE
        : this.sanitizeValue(nestedValue);
    }

    return sanitized;
  }

  private isSensitiveKey(key: string): boolean {
    const normalizedKey = normalizeKey(key);
    return SENSITIVE_KEY_PARTS.some((sensitivePart) => normalizedKey.includes(sensitivePart));
  }
}

export const auditSanitizerService = new AuditSanitizerService();
