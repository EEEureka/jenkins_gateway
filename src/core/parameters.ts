export type JenkinsBuildParameterKind =
  | "choice"
  | "string"
  | "boolean"
  | "extended-choice-checkbox"
  | "unknown";

export interface JenkinsBuildParameter {
  name: string;
  type?: string;
  kind: JenkinsBuildParameterKind;
  description?: string;
  defaultValue?: unknown;
  choices?: string[];
  source: "job-api" | "build-page-html";
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
    const choices = readChoices(definition);

    return [
      {
        name,
        type,
        kind: classifyParameter(type, definition),
        description: typeof definition.description === "string" ? definition.description : undefined,
        defaultValue: defaultParameterValue,
        choices: choices.length > 0 ? choices : undefined,
        source: "job-api" as const
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
      source: "build-page-html"
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

function classifyParameter(type: string | undefined, definition: Record<string, unknown>): JenkinsBuildParameterKind {
  const signature = `${type ?? ""} ${className(definition) ?? ""}`.toLowerCase();

  if (signature.includes("extended") && signature.includes("choice")) {
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
  if (!Array.isArray(definition.choices)) {
    return [];
  }

  return definition.choices.map(String).filter(Boolean);
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
