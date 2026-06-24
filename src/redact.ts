const SECRET_KEY_NAMES = new Set(["authorization", "password", "secret", "token", "apitoken", "crumb"]);

function isSecretKey(key: string): boolean {
  const normalized = key.replace(/[-_\s]/g, "").toLowerCase();
  return SECRET_KEY_NAMES.has(normalized) || normalized.endsWith("token");
}

export function redactValue(value: string, secrets: string[] = []): string {
  let redacted = value;

  for (const secret of secrets.filter(Boolean)) {
    redacted = redacted.split(secret).join("[REDACTED]");
  }

  return redacted;
}

export function redactObject<T>(value: T, secrets: string[] = []): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactObject(item, secrets)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        isSecretKey(key) ? "[REDACTED]" : redactObject(entry, secrets)
      ])
    ) as T;
  }

  if (typeof value === "string") {
    return redactValue(value, secrets) as T;
  }

  return value;
}
