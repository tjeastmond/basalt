import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadProjectEnvFiles } from "@/lib/server/loadEnvFile";
import { readLogConfig } from "@/lib/server/logging/config";
import { flushLogs, initLogger } from "@/lib/server/logging/logger";

async function main(): Promise<void> {
  loadProjectEnvFiles();

  const config = readLogConfig();

  if (!config.enabled) {
    console.error("Logging is disabled. Set LOG_ENABLED=true in .env.local to tail logs.");
    process.exit(2);
  }

  await initLogger();
  await flushLogs();

  const currentPath = join(config.dir, "current.log");
  const logPath = join(config.dir, config.file);

  if (!existsSync(currentPath) && !existsSync(logPath)) {
    console.error("Log file was not created.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
