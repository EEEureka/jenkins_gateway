import { redactObject } from "../core/redaction.js";

export function toJson(value: unknown, secrets: string[] = []): string {
  return `${JSON.stringify(redactObject(value, secrets), null, 2)}\n`;
}
