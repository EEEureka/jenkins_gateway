import type { JenkinsClient, JenkinsBuildTriggerResult } from "./jenkins-client.js";
import { validateBuildParameterValues } from "./parameters.js";

export interface UpgradeComponentOptions {
  compileJob: string;
  upgradeJob: string;
  component: string;
  parameterName?: string;
  compileBuild?: number | string;
  wait?: boolean;
  timeoutMs?: number;
  intervalMs?: number;
}

export interface UpgradeComponentResult {
  workflow: "upgrade-component";
  compile: {
    jobPath: string;
    build: number | string;
    result?: unknown;
    building?: unknown;
    url?: unknown;
  };
  upgrade: JenkinsBuildTriggerResult & {
    parameterName: string;
    component: string;
    buildNumber?: number;
    build?: Record<string, unknown>;
  };
}

export async function upgradeComponentWorkflow(
  client: JenkinsClient,
  options: UpgradeComponentOptions
): Promise<UpgradeComponentResult> {
  const parameterName = options.parameterName ?? "serviceList";
  const compileBuildRef = options.compileBuild ?? "lastBuild";
  const compileBuild = await client.getBuild(options.compileJob, compileBuildRef);

  if (compileBuild.building === true) {
    throw new Error(`Compile build is still running: ${options.compileJob} ${String(compileBuildRef)}`);
  }

  if (compileBuild.result && compileBuild.result !== "SUCCESS") {
    throw new Error(`Compile build is not successful: ${options.compileJob} result=${String(compileBuild.result)}`);
  }

  const parameterInfo = await client.getBuildParameters(options.upgradeJob);
  validateBuildParameterValues(parameterInfo.parameters, {
    [parameterName]: options.component
  });

  const triggerResult = await client.triggerBuild(options.upgradeJob, {
    [parameterName]: options.component
  });

  const result: UpgradeComponentResult = {
    workflow: "upgrade-component",
    compile: {
      jobPath: options.compileJob,
      build: compileBuildRef,
      result: compileBuild.result,
      building: compileBuild.building,
      url: compileBuild.url
    },
    upgrade: {
      ...triggerResult,
      parameterName,
      component: options.component
    }
  };

  if (options.wait && triggerResult.queueId !== undefined) {
    const queue = await client.waitForQueueItem(triggerResult.queueId, {
      timeoutMs: options.timeoutMs,
      intervalMs: options.intervalMs
    });

    if (queue.executable?.number !== undefined) {
      result.upgrade.buildNumber = queue.executable.number;
      result.upgrade.build = await client.waitForBuild(options.upgradeJob, queue.executable.number, {
        timeoutMs: options.timeoutMs,
        intervalMs: options.intervalMs
      });
    }
  }

  return result;
}
