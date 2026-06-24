#!/usr/bin/env node

import { runCli } from "./cli/index.js";

process.exitCode = await runCli();
