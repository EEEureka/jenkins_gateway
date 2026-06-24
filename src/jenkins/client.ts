import type { JenkinsGatewayConfig } from "../config.js";
import { JenkinsHttpError } from "./errors.js";
import { buildPath, isJobAllowed, jobPathToUrlPath, normalizeJobPath } from "./paths.js";

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

  async getJob(jobPath: string): Promise<Record<string, unknown>> {
    const response = await this.requestJson<Record<string, unknown>>(`${jobPathToUrlPath(jobPath)}/api/json`, {
      searchParams: {
        tree:
          "name,fullName,url,description,color,buildable,inQueue,nextBuildNumber,lastBuild[number,url],lastSuccessfulBuild[number,url],lastFailedBuild[number,url],property[parameterDefinitions[name,type,description,defaultParameterValue[value]]]"
      }
    });

    return response.data;
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
      maxChars?: number;
    } = {}
  ): Promise<JenkinsConsoleLog> {
    const start = options.start ?? 0;
    const maxChars = options.maxChars ?? this.config.consoleMaxChars;
    const response = await this.request(`${buildPath(jobPath, build)}/logText/progressiveText`, {
      searchParams: {
        start: String(start)
      },
      headers: {
        accept: "text/plain"
      }
    });

    const rawText = await response.text();
    const text = rawText.length > maxChars ? rawText.slice(0, maxChars) : rawText;
    const nextStart = Number(response.headers.get("x-text-size") ?? start + rawText.length);

    return {
      jobPath,
      build,
      start,
      nextStart,
      more: response.headers.get("x-more-data") === "true",
      text,
      truncated: rawText.length > maxChars
    };
  }

  async getQueueItem(queueId: number): Promise<Record<string, unknown>> {
    const response = await this.requestJson<Record<string, unknown>>(`/queue/item/${queueId}/api/json`);
    return response.data;
  }

  async triggerBuild(
    jobPath: string,
    parameters: Record<string, string | number | boolean> = {}
  ): Promise<JenkinsBuildTriggerResult> {
    this.assertMutationAllowed(jobPath);

    const hasParameters = Object.keys(parameters).length > 0;
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(parameters)) {
      body.set(key, String(value));
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
    this.assertMutationAllowed(jobPath);
    await this.post(`${buildPath(jobPath, build)}/stop`);

    return {
      jobPath: normalizeJobPath(jobPath),
      build,
      stopped: true
    };
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

  private assertMutationAllowed(jobPath: string): void {
    if (this.config.readOnly) {
      throw new Error("Jenkins mutation rejected: JENKINS_MCP_READ_ONLY is enabled");
    }

    if (!this.config.enableMutations) {
      throw new Error("Jenkins mutation rejected: JENKINS_MCP_ENABLE_MUTATIONS is not enabled");
    }

    if (!isJobAllowed(jobPath, this.config.jobAllowlist)) {
      throw new Error("Jenkins mutation rejected: jobPath is not in JENKINS_MCP_JOB_ALLOWLIST");
    }
  }
}

function extractQueueId(queueUrl: string): number | undefined {
  const match = /\/queue\/item\/(\d+)\/?/.exec(queueUrl);
  return match ? Number(match[1]) : undefined;
}
