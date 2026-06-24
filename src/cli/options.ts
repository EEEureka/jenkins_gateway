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

export function parseParameterEntries(entries: string[]): Record<string, string> {
  const parameters: Record<string, string> = {};

  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0) {
      throw new CliUsageError(`--param must use key=value syntax: ${entry}`);
    }

    const key = entry.slice(0, separatorIndex).trim();
    if (!key) {
      throw new CliUsageError(`--param key must not be empty: ${entry}`);
    }

    parameters[key] = entry.slice(separatorIndex + 1);
  }

  return parameters;
}
