import { describe, expect, it } from "vitest";

import { redactObject, redactValue } from "../../src/redact.js";

describe("redactValue", () => {
  it("redacts explicit secret strings", () => {
    expect(redactValue("token=abc123", ["abc123"])).toBe("token=[REDACTED]");
  });
});

describe("redactObject", () => {
  it("redacts secret-looking keys recursively", () => {
    expect(
      redactObject({
        authorization: "Basic abc",
        useCrumbs: true,
        nested: {
          apiToken: "secret"
        }
      })
    ).toEqual({
      authorization: "[REDACTED]",
      useCrumbs: true,
      nested: {
        apiToken: "[REDACTED]"
      }
    });
  });
});
