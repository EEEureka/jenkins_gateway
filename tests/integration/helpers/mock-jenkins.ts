import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export interface RecordedRequest {
  method: string;
  url: string;
  authorization?: string;
  crumb?: string;
  body: string;
}

export interface MockJenkins {
  baseUrl: string;
  requests: RecordedRequest[];
  close(): Promise<void>;
}

export async function startMockJenkins(): Promise<MockJenkins> {
  const requests: RecordedRequest[] = [];

  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    void handleRequest(request, response, requests).catch((error: unknown) => {
      response.writeHead(500, {
        "content-type": "text/plain"
      });
      response.end(error instanceof Error ? error.message : String(error));
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Mock Jenkins failed to bind to a TCP port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}/`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  requests: RecordedRequest[]
): Promise<void> {
  const body = await readRequestBody(request);

    requests.push({
      method: request.method ?? "GET",
      url: request.url ?? "/",
      authorization: request.headers.authorization,
      crumb: request.headers["jenkins-crumb"] as string | undefined,
      body
    });

    if (request.url === "/crumbIssuer/api/json") {
      response.writeHead(200, {
        "content-type": "application/json"
      });
      response.end(
        JSON.stringify({
          crumbRequestField: "Jenkins-Crumb",
          crumb: "crumb-value"
        })
      );
      return;
    }

    if (request.url?.startsWith("/api/json")) {
      response.writeHead(200, {
        "content-type": "application/json",
        "x-jenkins": "2.492.1"
      });
      response.end(
        JSON.stringify({
          mode: "NORMAL",
          nodeName: "built-in",
          nodeDescription: "mock controller",
          useCrumbs: true
        })
      );
      return;
    }

    if (request.url?.startsWith("/job/folder%20a/api/json")) {
      response.writeHead(200, {
        "content-type": "application/json"
      });
      response.end(
        JSON.stringify({
          jobs: [
            {
              name: "build-app",
              fullName: "folder a/build-app",
              url: "http://jenkins/job/folder%20a/job/build-app/",
              color: "blue",
              _class: "hudson.model.FreeStyleProject"
            }
          ]
        })
      );
      return;
    }

    if (request.url?.startsWith("/job/folder%20a/job/build-app/api/json")) {
      response.writeHead(200, {
        "content-type": "application/json"
      });
      response.end(
        JSON.stringify({
          name: "build-app",
          fullName: "folder a/build-app",
          buildable: true,
          inQueue: false,
          lastBuild: {
            number: 42,
            url: "http://jenkins/job/folder%20a/job/build-app/42/"
          }
        })
      );
      return;
    }

    if (request.url?.startsWith("/job/folder%20a/job/build-app/42/api/json")) {
      response.writeHead(200, {
        "content-type": "application/json"
      });
      response.end(
        JSON.stringify({
          number: 42,
          result: "SUCCESS",
          building: false,
          duration: 1200
        })
      );
      return;
    }

    if (request.url?.startsWith("/job/folder%20a/job/build-app/42/logText/progressiveText")) {
      response.writeHead(200, {
        "content-type": "text/plain",
        "x-text-size": "64",
        "x-more-data": "false"
      });
      response.end("line 1\nline 2\nline 3\n");
      return;
    }

    if (request.method === "POST" && request.url === "/job/folder%20a/job/build-app/buildWithParameters") {
      if (request.headers["jenkins-crumb"] !== "crumb-value") {
        response.writeHead(403, {
          "content-type": "text/plain"
        });
        response.end("missing crumb");
        return;
      }

      response.writeHead(201, {
        location: "/queue/item/101/"
      });
      response.end("");
      return;
    }

    if (request.method === "POST" && request.url === "/job/folder%20a/job/build-app/42/stop") {
      if (request.headers["jenkins-crumb"] !== "crumb-value") {
        response.writeHead(403, {
          "content-type": "text/plain"
        });
        response.end("missing crumb");
        return;
      }

      response.writeHead(200, {
        "content-type": "text/plain"
      });
      response.end("");
      return;
    }

    if (request.url === "/queue/item/100/api/json") {
      response.writeHead(200, {
        "content-type": "application/json"
      });
      response.end(
        JSON.stringify({
          id: 100,
          blocked: false,
          buildable: true
        })
      );
      return;
    }

    if (request.url === "/whoAmI/api/json") {
      response.writeHead(200, {
        "content-type": "application/json"
      });
      response.end(
        JSON.stringify({
          id: "alice",
          fullName: "Alice Example",
          authenticated: true,
          authorities: ["authenticated"]
        })
      );
      return;
    }

    response.writeHead(404, {
      "content-type": "text/plain"
    });
    response.end("not found");
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}
