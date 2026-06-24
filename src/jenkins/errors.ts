export class JenkinsHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly statusText: string,
    readonly bodySnippet: string
  ) {
    super(message);
    this.name = "JenkinsHttpError";
  }
}
