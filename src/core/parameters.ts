export type JenkinsBuildParameterKind =
  | "choice"
  | "string"
  | "boolean"
  | "extended-choice-checkbox"
  | "unknown";

export type JenkinsBuildParameterSource = "job-api" | "build-page-html";

export interface JenkinsBuildParameter {
  name: string;
  type?: string;
  kind: JenkinsBuildParameterKind;
  description?: string;
  defaultValue?: unknown;
  choices?: string[];
  source: JenkinsBuildParameterSource;
  choicesSource?: JenkinsBuildParameterSource | "job-api-value";
  choicesUnavailableReason?: string;
  multiValue?: boolean;
  delimiter?: string;
}

export interface ParameterVerificationMismatch {
  name: string;
  expected: string[];
  actual: string[];
  reason: "missing" | "empty" | "different";
}

export interface ParameterVerificationResult {
  ok: boolean;
  expected: Record<string, string[]>;
  actual: Record<string, string[]>;
  mismatches: ParameterVerificationMismatch[];
}

export function extractParameterDefinitions(job: Record<string, unknown>): JenkinsBuildParameter[] {
  const definitions = (Array.isArray(job.property) ? job.property : []).flatMap((property) => {
    if (!isRecord(property) || !Array.isArray(property.parameterDefinitions)) {
      return [];
    }

    return property.parameterDefinitions.filter(isRecord);
  });

  return definitions.flatMap((definition) => {
    const name = typeof definition.name === "string" ? definition.name : undefined;
    if (!name) {
      return [];
    }

    const type = typeof definition.type === "string" ? definition.type : className(definition);
    const defaultParameterValue = isRecord(definition.defaultParameterValue) ? definition.defaultParameterValue.value : undefined;
    const kind = classifyParameter(type, definition);
    const choices = readChoices(definition);
    const expectsChoices = kind === "choice" || kind === "extended-choice-checkbox";

    return [
      {
        name,
        type,
        kind,
        description: typeof definition.description === "string" ? definition.description : undefined,
        defaultValue: defaultParameterValue,
        choices: choices.length > 0 ? choices : undefined,
        source: "job-api" as const,
        choicesSource: choices.length > 0 ? readChoicesSource(definition) : undefined,
        choicesUnavailableReason: choices.length === 0 && expectsChoices ? "job-api-no-choices" : undefined,
        multiValue: isMultiValueParameter(type, definition),
        delimiter: readDelimiter(definition)
      }
    ];
  });
}

export function mergeBuildPageChoices(parameters: JenkinsBuildParameter[], html: string): JenkinsBuildParameter[] {
  return parameters.map((parameter) => {
    if (parameter.choices && parameter.choices.length > 0) {
      return parameter;
    }

    const choices = extractChoicesFromBuildPage(html, parameter.name);
    if (choices.length === 0) {
      return parameter;
    }

    return {
      ...parameter,
      choices,
      source: "build-page-html",
      choicesSource: "build-page-html",
      choicesUnavailableReason: undefined
    };
  });
}

export function markChoicesUnavailable(
  parameters: JenkinsBuildParameter[],
  reason: string
): JenkinsBuildParameter[] {
  return parameters.map((parameter) => {
    if ((parameter.kind !== "choice" && parameter.kind !== "extended-choice-checkbox") || parameter.choices?.length) {
      return parameter;
    }

    return {
      ...parameter,
      choicesUnavailableReason: reason
    };
  });
}

export function validateBuildParameterValues(
  parameters: JenkinsBuildParameter[],
  values: Record<string, string | number | boolean | string[]>
): void {
  const definitions = new Map(parameters.map((parameter) => [parameter.name, parameter]));

  for (const [name, value] of Object.entries(values)) {
    const definition = definitions.get(name);
    if (!definition?.choices || definition.choices.length === 0) {
      continue;
    }

    const submittedValues = Array.isArray(value) ? value.map(String) : String(value).split(",").map((entry) => entry.trim());
    const invalidValue = submittedValues.find((entry) => entry && !definition.choices!.includes(entry));
    if (invalidValue) {
      throw new Error(`Invalid Jenkins parameter value: ${name}=${invalidValue}`);
    }
  }
}

export function extractBuildParameterValues(build: Record<string, unknown>): Record<string, string[]> {
  const values: Record<string, string[]> = {};
  const actions = Array.isArray(build.actions) ? build.actions : [];

  for (const action of actions) {
    if (!isRecord(action) || !Array.isArray(action.parameters)) {
      continue;
    }

    for (const parameter of action.parameters) {
      if (!isRecord(parameter) || typeof parameter.name !== "string") {
        continue;
      }

      values[parameter.name] = normalizeParameterValue(parameter.value);
    }
  }

  return values;
}

export function verifyBuildParameterValues(
  expectedValues: Record<string, string | number | boolean | string[]>,
  build: Record<string, unknown>
): ParameterVerificationResult {
  const expected = Object.fromEntries(
    Object.entries(expectedValues).map(([name, value]) => [name, normalizeParameterValue(value)])
  );
  const actual = extractBuildParameterValues(build);
  const mismatches: ParameterVerificationMismatch[] = [];

  for (const [name, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[name];
    if (!actualValue) {
      mismatches.push({
        name,
        expected: expectedValue,
        actual: [],
        reason: "missing"
      });
      continue;
    }

    if (actualValue.length === 0) {
      mismatches.push({
        name,
        expected: expectedValue,
        actual: actualValue,
        reason: "empty"
      });
      continue;
    }

    if (!sameStringSet(expectedValue, actualValue)) {
      mismatches.push({
        name,
        expected: expectedValue,
        actual: actualValue,
        reason: "different"
      });
    }
  }

  return {
    ok: mismatches.length === 0,
    expected,
    actual,
    mismatches
  };
}

export function normalizeParameterValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeParameterValue(entry));
  }

  if (value === undefined || value === null) {
    return [];
  }

  const stringValue = String(value);
  if (!stringValue.trim()) {
    return [];
  }

  return stringValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function classifyParameter(type: string | undefined, definition: Record<string, unknown>): JenkinsBuildParameterKind {
  const signature = `${type ?? ""} ${className(definition) ?? ""}`.toLowerCase();

  if (
    (signature.includes("extended") && signature.includes("choice")) ||
    signature.includes("pt_checkbox") ||
    signature.includes("checkbox")
  ) {
    return "extended-choice-checkbox";
  }

  if (signature.includes("choice")) {
    return "choice";
  }

  if (signature.includes("boolean")) {
    return "boolean";
  }

  if (signature.includes("string") || signature.includes("text")) {
    return "string";
  }

  return "unknown";
}

function readChoices(definition: Record<string, unknown>): string[] {
  if (Array.isArray(definition.choices)) {
    return definition.choices.map(String).filter(Boolean);
  }

  if (typeof definition.value === "string") {
    return splitDelimitedValues(definition.value, readDelimiter(definition));
  }

  return [];
}

function readChoicesSource(definition: Record<string, unknown>): JenkinsBuildParameter["choicesSource"] {
  return Array.isArray(definition.choices) ? "job-api" : "job-api-value";
}

function readDelimiter(definition: Record<string, unknown>): string | undefined {
  const rawDelimiter =
    typeof definition.multiSelectDelimiter === "string"
      ? definition.multiSelectDelimiter
      : typeof definition.delimiter === "string"
        ? definition.delimiter
        : undefined;

  return rawDelimiter || undefined;
}

function isMultiValueParameter(type: string | undefined, definition: Record<string, unknown>): boolean | undefined {
  const signature = `${type ?? ""} ${className(definition) ?? ""}`.toLowerCase();
  if (signature.includes("pt_checkbox") || signature.includes("checkbox")) {
    return true;
  }

  if (typeof definition.multiSelectDelimiter === "string") {
    return true;
  }

  return undefined;
}

function splitDelimitedValues(value: string, delimiter: string | undefined): string[] {
  const normalizedDelimiter = delimiter === "\\n" ? "\n" : delimiter;
  const pattern = normalizedDelimiter ? escapeRegExp(normalizedDelimiter) : "[,\\n]";

  return value
    .split(new RegExp(pattern))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function extractChoicesFromBuildPage(html: string, parameterName: string): string[] {
  const parameterIndex = html.indexOf(parameterName);
  if (parameterIndex === -1) {
    return [];
  }

  const block = html.slice(Math.max(0, parameterIndex - 2_000), parameterIndex + 8_000);
  const choices = new Set<string>();
  const valuePattern = /<(?:input|option)\b[^>]*\bvalue=(["'])(.*?)\1[^>]*>/gis;

  for (const match of block.matchAll(valuePattern)) {
    const value = decodeHtmlEntities(match[2] ?? "").trim();
    if (!value || value === parameterName || value === "on" || value === "true" || value === "false") {
      continue;
    }
    choices.add(value);
  }

  return [...choices];
}

function className(definition: Record<string, unknown>): string | undefined {
  return typeof definition._class === "string" ? definition._class : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightValues = new Set(right);
  return left.every((entry) => rightValues.has(entry));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
