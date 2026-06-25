export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export function removeFlag(args: string[], flag: string): boolean {
  const index = args.indexOf(flag);
  if (index === -1) {
    return false;
  }

  args.splice(index, 1);
  return true;
}

export function readOption(args: string[], name: string): string | undefined {
  const index = args.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
  if (index === -1) {
    return undefined;
  }

  const arg = args[index]!;
  if (arg.startsWith(`${name}=`)) {
    args.splice(index, 1);
    return arg.slice(name.length + 1);
  }

  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new CliUsageError(`${name} requires a value`);
  }

  args.splice(index, 2);
  return value;
}

export function readRepeatedOption(args: string[], name: string): string[] {
  const values: string[] = [];

  while (true) {
    const value = readOption(args, name);
    if (value === undefined) {
      return values;
    }
    values.push(value);
  }
}

export function requireNoArgs(args: string[]): void {
  if (args.length > 0) {
    throw new CliUsageError(`Unexpected arguments: ${args.join(" ")}`);
  }
}

export function requirePositional(value: string | undefined, name: string): string {
  if (!value || value.startsWith("--")) {
    throw new CliUsageError(`${name} is required`);
  }
  return value;
}

export type CliParameterValue = string | number | boolean | string[];

export function parseParameterEntries(entries: string[]): Record<string, CliParameterValue> {
  const parameters: Record<string, CliParameterValue> = {};

  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0) {
      throw new CliUsageError(`--param must use key=value syntax: ${entry}`);
    }

    const key = entry.slice(0, separatorIndex).trim();
    if (!key) {
      throw new CliUsageError(`--param key must not be empty: ${entry}`);
    }

    appendParameterValue(parameters, key, entry.slice(separatorIndex + 1));
  }

  return parameters;
}

export function parseParameterJson(value: string | undefined): Record<string, CliParameterValue> {
  if (value === undefined) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new CliUsageError(`--param-json must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CliUsageError("--param-json must be a JSON object");
  }

  const parameters: Record<string, CliParameterValue> = {};
  for (const [key, rawValue] of Object.entries(parsed)) {
    if (!key.trim()) {
      throw new CliUsageError("--param-json keys must not be empty");
    }

    if (typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean") {
      parameters[key] = rawValue;
      continue;
    }

    if (Array.isArray(rawValue) && rawValue.every((entry) => typeof entry === "string")) {
      parameters[key] = rawValue;
      continue;
    }

    throw new CliUsageError(`--param-json value for ${key} must be a string, number, boolean, or string array`);
  }

  return parameters;
}

export function mergeParameters(
  left: Record<string, CliParameterValue>,
  right: Record<string, CliParameterValue>
): Record<string, CliParameterValue> {
  const merged: Record<string, CliParameterValue> = { ...left };
  for (const [key, value] of Object.entries(right)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        appendParameterValue(merged, key, entry);
      }
      continue;
    }

    appendParameterValue(merged, key, value);
  }

  return merged;
}

function appendParameterValue(parameters: Record<string, CliParameterValue>, key: string, value: CliParameterValue): void {
  const currentValue = parameters[key];
  if (currentValue === undefined) {
    parameters[key] = value;
    return;
  }

  parameters[key] = [...toStringArray(currentValue), ...toStringArray(value)];
}

function toStringArray(value: CliParameterValue): string[] {
  return Array.isArray(value) ? value : [String(value)];
}
