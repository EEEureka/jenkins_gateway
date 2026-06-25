import { describe, expect, it } from "vitest";

import {
  extractParameterDefinitions,
  mergeBuildPageChoices,
  validateBuildParameterValues,
  verifyBuildParameterValues
} from "../../src/core/parameters.js";

describe("build parameter helpers", () => {
  it("extracts standard parameter definitions", () => {
    const parameters = extractParameterDefinitions({
      property: [
        {
          parameterDefinitions: [
            {
              name: "branch",
              type: "ChoiceParameterDefinition",
              choices: ["main", "release"],
              defaultParameterValue: {
                value: "main"
              }
            }
          ]
        }
      ]
    });

    expect(parameters).toEqual([
      expect.objectContaining({
        name: "branch",
        kind: "choice",
        choices: ["main", "release"],
        defaultValue: "main"
      })
    ]);
  });

  it("extracts extended choice values from build page html", () => {
    const [parameter] = mergeBuildPageChoices(
      [
        {
          name: "serviceList",
          type: "ExtendedChoiceParameterDefinition",
          kind: "extended-choice-checkbox",
          source: "job-api"
        }
      ],
      '<div><span>serviceList</span><input type="checkbox" value="MACC-FRONT-RELEASE"><input value="OCE-RELEASE"></div>'
    );

    expect(parameter).toMatchObject({
      name: "serviceList",
      choices: ["MACC-FRONT-RELEASE", "OCE-RELEASE"],
      source: "build-page-html"
    });
  });

  it("extracts extended choice values from job api value fields", () => {
    const [parameter] = extractParameterDefinitions({
      property: [
        {
          parameterDefinitions: [
            {
              name: "serviceList",
              type: "PT_CHECKBOX",
              _class: "com.cwctravel.hudson.plugins.extended_choice_parameter.ExtendedChoiceParameterDefinition",
              value: "MACC-FRONT-RELEASE,OCE-RELEASE",
              multiSelectDelimiter: ","
            }
          ]
        }
      ]
    });

    expect(parameter).toMatchObject({
      name: "serviceList",
      kind: "extended-choice-checkbox",
      choices: ["MACC-FRONT-RELEASE", "OCE-RELEASE"],
      choicesSource: "job-api-value",
      multiValue: true
    });
  });

  it("rejects submitted values outside known choices", () => {
    expect(() =>
      validateBuildParameterValues(
        [
          {
            name: "serviceList",
            kind: "choice",
            choices: ["MACC-FRONT-RELEASE"],
            source: "job-api"
          }
        ],
        {
          serviceList: "unknown"
        }
      )
    ).toThrow("Invalid Jenkins parameter value");
  });

  it("detects parameters that did not land in the build", () => {
    const verification = verifyBuildParameterValues(
      {
        serviceList: "MACC-FRONT-RELEASE"
      },
      {
        actions: [
          {
            parameters: [
              {
                name: "serviceList",
                value: ""
              }
            ]
          }
        ]
      }
    );

    expect(verification).toMatchObject({
      ok: false,
      mismatches: [
        {
          name: "serviceList",
          reason: "empty"
        }
      ]
    });
  });
});
