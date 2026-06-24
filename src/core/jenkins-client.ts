import type { JenkinsGatewayConfig } from "./config.js";
import { assertProtectedToolDecision, explainProtectedToolDecision, type ProtectedToolDecision } from "./authz.js";
import { JenkinsHttpError } from "./errors.js";
import { buildPath, jobPathToUrlPath, normalizeJobPath } from "./job-paths.js";
import {
  extractParameterDefinitions,
  mergeBuildPageChoices,
  validateBuildParameterValues,
  type JenkinsBuildParameter
} from "./parameters.js";

export interface JenkinsServerInfo {
  baseUrl: string;
  profile: string;
  reachable: true;
  version?: string;
  mode?: unknown;
  nodeName?: unknown;
  nodeDescription?: unknown;
  useCrumbs?: unknown;
  user?: {
    id?: unknown;
    fullName?: unknown;
    authenticated?: unknown;
    authorities?: unknown;
  };
}

export interface JenkinsJobSummary {
  name?: unknown;
  fullName?: unknown;
  url?: unknown;
  color?: unknown;
  className?: unknown;
}

export interface JenkinsJobList {
  folderPath?: string;
  viewName?: string;
  jobs: JenkinsJobSummary[];
}

export interface JenkinsViewSummary {
  name?: unknown;
  url?: unknown;
  className?: unknown;
}

export interface JenkinsViewList {
  views: JenkinsViewSummary[];
}

export interface JenkinsView {
  name?: unknown;
  url?: unknown;
  description?: unknown;
  jobs: JenkinsJobSummary[];
}

export interface JenkinsConsoleLog {
  jobPath: string;
  build: number | string;
  start: number;
  nextStart: number;
  more: boolean;
  text: string;
  truncated: boolean;
}

export interface JenkinsBuildTriggerResult {
  jobPath: string;
  queued: true;
  queueUrl?: string;
  queueId?: number;
}

export interface JenkinsStopBuildResult {
  jobPath: string;
  build: number | string;
  stopped: true;
}

export interface JenkinsQueueWaitResult {
  queueId: number;
  item: Record<string, unknown>;
  executable?: {
    number?: number;
    url?: string;
  };
}

export interface WaitOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

interface JenkinsCrumb {
  crumbRequestField: string;
  crumb: string;
}

export type FetchLike = typeof fetch;

export class JenkinsClient {
  private cachedCrumb?: JenkinsCrumb;

  constructor(
    private readonly config: JenkinsGatewayConfig,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async getServerInfo(): Promise<JenkinsServerInfo> {
    const rootResponse = await this.requestJson<Record<string, unknown>>("/api/json", {
      searchParams: {
        tree: "nodeName,nodeDescription,mode,useCrumbs"
      }
    });

    const user = await this.requestOptionalJson<Record<string, unknown>>("/whoAmI/api/json");

    return {
      baseUrl: this.config.baseUrl.toString(),
      profile: this.config.profile,
      reachable: true,
      version: rootResponse.headers.get("x-jenkins") ?? undefined,
      mode: rootResponse.data.mode,
      nodeName: rootResponse.data.nodeName,
      nodeDescription: rootResponse.data.nodeDescription,
      useCrumbs: rootResponse.data.useCrumbs,
      user: user
        ? {
            id: user.data.id,
            fullName: user.data.fullName,
            authenticated: user.data.authenticated,
            authorities: user.data.authorities
          }
        : undefined
    };
  }

  async requestOptionalJson<T>(path: string): Promise<{ data: T; headers: Headers } | undefined> {
    try {
      return await this.requestJson<T>(path);
    } catch (error) {
      if (error instanceof JenkinsHttpError && error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  async listJobs(folderPath?: string): Promise<JenkinsJobList> {
    const path = folderPath ? `${jobPathToUrlPath(folderPath)}/api/json` : "/api/json";
    const response = await this.requestJson<{ jobs?: Array<Record<string, unknown>> }>(path, {
      searchParams: {
        tree: "jobs[name,fullName,url,color,_class]"
      }
    });

    return {
      folderPath,
      jobs: (response.data.jobs ?? []).map((job) => ({
        name: job.name,
        fullName: job.fullName,
        url: job.url,
        color: job.color,
        className: job._class
      }))
    };
  }

  async listViews(): Promise<JenkinsViewList> {
    const response = await this.requestJson<{ views?: Array<Record<string, unknown>> }>("/api/json", {
      searchParams: {
        tree: "views[name,url,_class]"
      }
    });

    return {
      views: (response.data.views ?? []).map((view) => ({
        name: view.name,
        url: view.url,
        className: view._class
      }))
    };
  }

  async getView(viewName: string): Promise<JenkinsView> {
    const response = await this.requestJson<Record<string, unknown>>(`${viewPath(viewName)}/api/json`, {
      searchParams: {
        tree: "name,url,description,jobs[name,fullName,url,color,_class]"
      }
    });

    return {
      name: response.data.name,
      url: response.data.url,
      description: response.data.description,
      jobs: (Array.isArray(response.data.jobs) ? response.data.jobs : []).filter(isRecord).map((job) => ({
        name: job.name,
        fullName: job.fullName,
        url: job.url,
        color: job.color,
        className: job._class
      }))
    };
  }

  async listJobsInView(viewName: string): Promise<JenkinsJobList> {
    const view = await this.getView(viewName);
    return {
      viewName,
      jobs: view.jobs
    };
  }

  async getJob(jobPath: string): Promise<Record<string, unknown>> {
    const response = await this.requestJson<Record<string, unknown>>(`${jobPathToUrlPath(jobPath)}/api/json`, {
      searchParams: {
        tree:
          "name,fullName,url,description,color,buildable,inQueue,nextBuildNumber,lastBuild[number,url],lastSuccessfulBuild[number,url],lastFailedBuild[number,url],property[parameterDefinitions[name,type,_class,description,choices,defaultParameterValue[value]]]"
      }
    });

    return response.data;
  }

  async getBuildParameters(jobPath: string): Promise<{ jobPath: string; parameters: JenkinsBuildParameter[] }> {
    const job = await this.getJob(jobPath);
    let parameters = extractParameterDefinitions(job);

    if (parameters.some((parameter) => !parameter.choices || parameter.choices.length === 0)) {
      try {
        const html = await this.requestText(`${jobPathToUrlPath(jobPath)}/build`);
        parameters = mergeBuildPageChoices(parameters, html);
      } catch (error) {
        if (!(error instanceof JenkinsHttpError && error.status === 404)) {
          throw error;
        }
      }
    }

    return {
      jobPath: normalizeJobPath(jobPath),
      parameters
    };
  }

  async getBuild(jobPath: string, build: number | string): Promise<Record<string, unknown>> {
    const response = await this.requestJson<Record<string, unknown>>(`${buildPath(jobPath, build)}/api/json`, {
      searchParams: {
        tree:
          "number,url,result,building,duration,estimatedDuration,timestamp,description,displayName,fullDisplayName,id,queueId,builtOn,actions[causes[*]],changeSet[*]"
      }
    });

    return response.data;
  }

  async getConsoleLog(
    jobPath: string,
    build: number | string,
    options: {
      start?: number;
      maxBytes?: number;
    } = {}
  ): Promise<JenkinsConsoleLog> {
    await this.assertProtectedToolAllowed("jenkins.get_console_log", jobPath);
    const start = options.start ?? 0;
    const maxBytes = options.maxBytes ?? this.config.consoleLogMaxBytes;
    const response = await this.request(`${buildPath(jobPath, build)}/logText/progressiveText`, {
      searchParams: {
        start: String(start)
      },
      headers: {
        accept: "text/plain"
      }
    });

    const rawText = await response.text();
    const text = rawText.length > maxBytes ? rawText.slice(0, maxBytes) : rawText;
    const nextStart = Number(response.headers.get("x-text-size") ?? start + rawText.length);

    return {
      jobPath,
      build,
      start,
      nextStart,
      more: response.headers.get("x-more-data") === "true",
      text,
      truncated: rawText.length > maxBytes
    };
  }

  async getQueueItem(queueId: number): Promise<Record<string, unknown>> {
    const response = await this.requestJson<Record<string, unknown>>(`/queue/item/${queueId}/api/json`);
    return response.data;
  }

  async triggerBuild(
    jobPath: string,
    parameters: Record<string, string | number | boolean | string[]> = {}
  ): Promise<JenkinsBuildTriggerResult> {
    await this.assertProtectedToolAllowed("jenkins.trigger_build", jobPath);
    await this.validateBuildParameters(jobPath, parameters);

    const hasParameters = Object.keys(parameters).length > 0;
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(parameters)) {
      body.set(key, Array.isArray(value) ? value.join(",") : String(value));
    }

    const response = await this.post(
      `${jobPathToUrlPath(jobPath)}/${hasParameters ? "buildWithParameters" : "build"}`,
      hasParameters
        ? {
            body,
            headers: {
              "content-type": "application/x-www-form-urlencoded"
            }
          }
        : {}
    );

    const queueUrl = response.headers.get("location") ?? undefined;

    return {
      jobPath: normalizeJobPath(jobPath),
      queued: true,
      queueUrl,
      queueId: queueUrl ? extractQueueId(queueUrl) : undefined
    };
  }

  async stopBuild(jobPath: string, build: number | string): Promise<JenkinsStopBuildResult> {
    await this.assertProtectedToolAllowed("jenkins.stop_build", jobPath);
    await this.post(`${buildPath(jobPath, build)}/stop`);

    return {
      jobPath: normalizeJobPath(jobPath),
      build,
      stopped: true
    };
  }

  async waitForQueueItem(queueId: number, options: WaitOptions = {}): Promise<JenkinsQueueWaitResult> {
    const timeoutMs = options.timeoutMs ?? 900_000;
    const intervalMs = options.intervalMs ?? 2_000;
    const expiresAt = Date.now() + timeoutMs;

    while (true) {
      const item = await this.getQueueItem(queueId);
      const executable = isRecord(item.executable) ? item.executable : undefined;
      if (executable) {
        return {
          queueId,
          item,
          executable: {
            number: typeof executable.number === "number" ? executable.number : undefined,
            url: typeof executable.url === "string" ? executable.url : undefined
          }
        };
      }

      if (item.cancelled === true) {
        throw new Error(`Jenkins queue item ${queueId} was cancelled`);
      }

      if (Date.now() >= expiresAt) {
        throw new Error(`Timed out waiting for Jenkins queue item ${queueId}`);
      }

      await delay(intervalMs);
    }
  }

  async waitForBuild(jobPath: string, build: number | string, options: WaitOptions = {}): Promise<Record<string, unknown>> {
    const timeoutMs = options.timeoutMs ?? 900_000;
    const intervalMs = options.intervalMs ?? 5_000;
    const expiresAt = Date.now() + timeoutMs;

    while (true) {
      const result = await this.getBuild(jobPath, build);
      if (result.building !== true) {
        return result;
      }

      if (Date.now() >= expiresAt) {
        throw new Error(`Timed out waiting for Jenkins build ${normalizeJobPath(jobPath)} #${String(build)}`);
      }

      await delay(intervalMs);
    }
  }

  async requestJson<T>(
    path: string,
    options: {
      method?: string;
      searchParams?: Record<string, string>;
      headers?: HeadersInit;
      body?: BodyInit;
    } = {}
  ): Promise<{ data: T; headers: Headers }> {
    const response = await this.request(path, {
      ...options,
      headers: {
        accept: "application/json",
        ...options.headers
      }
    });

    const data = (await response.json()) as T;
    return { data, headers: response.headers };
  }

  async requestText(
    path: string,
    options: {
      method?: string;
      searchParams?: Record<string, string>;
      headers?: HeadersInit;
      body?: BodyInit;
    } = {}
  ): Promise<string> {
    const response = await this.request(path, {
      ...options,
      headers: {
        accept: "text/html,text/plain",
        ...options.headers
      }
    });

    return response.text();
  }

  async request(
    path: string,
    options: {
      method?: string;
      searchParams?: Record<string, string>;
      headers?: HeadersInit;
      body?: BodyInit;
    } = {}
  ): Promise<Response> {
    const url = this.resolveUrl(path, options.searchParams);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method: options.method ?? "GET",
        headers: {
          authorization: this.authorizationHeader(),
          ...options.headers
        },
        body: options.body,
        signal: controller.signal
      });

      if (!response.ok) {
        const bodySnippet = (await response.text()).slice(0, 1_000);
        throw new JenkinsHttpError(
          `Jenkins request failed with ${response.status} ${response.statusText}`,
          response.status,
          response.statusText,
          bodySnippet
        );
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  async post(
    path: string,
    options: {
      headers?: HeadersInit;
      body?: BodyInit;
    } = {}
  ): Promise<Response> {
    const crumb = await this.getCrumb();

    return this.request(path, {
      method: "POST",
      headers: {
        [crumb.crumbRequestField]: crumb.crumb,
        ...options.headers
      },
      body: options.body
    });
  }

  async getCrumb(): Promise<JenkinsCrumb> {
    if (this.cachedCrumb) {
      return this.cachedCrumb;
    }

    const response = await this.requestJson<JenkinsCrumb>("/crumbIssuer/api/json");
    if (!response.data.crumbRequestField || !response.data.crumb) {
      throw new JenkinsHttpError("Jenkins crumb issuer returned an invalid response", 502, "Bad Gateway", "");
    }

    this.cachedCrumb = response.data;
    return this.cachedCrumb;
  }

  resolveUrl(path: string, searchParams: Record<string, string> = {}): URL {
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
    const url = new URL(normalizedPath, this.config.baseUrl);

    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }

    return url;
  }

  private authorizationHeader(): string {
    const token = Buffer.from(`${this.config.userId}:${this.config.apiToken}`, "utf8").toString("base64");
    return `Basic ${token}`;
  }

  async explainProtectedToolDecision(toolName: string, jobPath: string): Promise<ProtectedToolDecision> {
    return explainProtectedToolDecision({
      config: this.config,
      toolName,
      jobPath,
      listJobsInView: (viewName) => this.listJobsInView(viewName)
    });
  }

  private async assertProtectedToolAllowed(toolName: string, jobPath: string): Promise<void> {
    assertProtectedToolDecision(await this.explainProtectedToolDecision(toolName, jobPath));
  }

  private async validateBuildParameters(
    jobPath: string,
    parameters: Record<string, string | number | boolean | string[]>
  ): Promise<void> {
    if (Object.keys(parameters).length === 0) {
      return;
    }

    const { parameters: definitions } = await this.getBuildParameters(jobPath);
    validateBuildParameterValues(definitions, parameters);
  }
}

function extractQueueId(queueUrl: string): number | undefined {
  const match = /\/queue\/item\/(\d+)\/?/.exec(queueUrl);
  return match ? Number(match[1]) : undefined;
}

function viewPath(viewName: string): string {
  const normalizedViewName = viewName.trim();
  if (!normalizedViewName) {
    throw new Error("viewName must not be empty");
  }

  return `/view/${encodeURIComponent(normalizedViewName)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
