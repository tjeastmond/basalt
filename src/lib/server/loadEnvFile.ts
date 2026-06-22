import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Load KEY=VALUE pairs from a dotenv file without overwriting existing env vars. */
export function loadEnvFile(filePath: string, env: Record<string, string | undefined> = process.env): void {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (key.length === 0 || key in env) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }
}

export function loadProjectEnvFiles(cwd = process.cwd()): void {
  loadEnvFile(join(cwd, ".env.local"));
  loadEnvFile(join(cwd, ".env"));
}
