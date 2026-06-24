import { loadConfig, type JenkinsGatewayConfig } from "../core/config.js";
import { JenkinsClient } from "../core/jenkins-client.js";

export interface CliContext {
  config: JenkinsGatewayConfig;
  client: JenkinsClient;
}

export function createCliContext(env: NodeJS.ProcessEnv): CliContext {
  const config = loadConfig(env);
  return {
    config,
    client: new JenkinsClient(config)
  };
}
