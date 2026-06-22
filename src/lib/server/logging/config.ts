import { join } from "node:path";
import { z } from "zod";
import type { LogLevel } from "./types";

export type LogConfig = {
  enabled: boolean;
  level: LogLevel;
  dir: string;
  file: string;
  maxSize: string;
  maxFiles: number;
};

const logLevelSchema = z.enum(["debug", "info", "warn", "error", "silent"]);

const rawEnvSchema = z.object({
  LOG_ENABLED: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
  LOG_DIR: z.string().optional(),
  LOG_FILE: z.string().optional(),
  LOG_MAX_SIZE: z.string().optional(),
  LOG_MAX_FILES: z.string().optional(),
  VITEST: z.string().optional(),
});

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  return defaultValue;
}

function parseMaxFiles(value: string | undefined): number {
  if (!value?.trim()) return 7;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return 7;
  return parsed;
}

export function readLogConfig(env: Record<string, string | undefined> = process.env): LogConfig {
  const parsed = rawEnvSchema.parse(env);
  const levelRaw = parsed.LOG_LEVEL ?? "info";
  const levelParsed = logLevelSchema.safeParse(levelRaw);
  const level: LogLevel = levelParsed.success ? levelParsed.data : "info";

  const enabled = parsed.LOG_ENABLED !== undefined ? parseBoolean(parsed.LOG_ENABLED, true) : parsed.VITEST !== "true";

  return {
    enabled,
    level,
    dir: parsed.LOG_DIR?.trim() || join(process.cwd(), "data", "logs"),
    file: parsed.LOG_FILE?.trim() || "basalt.log",
    maxSize: parsed.LOG_MAX_SIZE?.trim() || "5m",
    maxFiles: parseMaxFiles(parsed.LOG_MAX_FILES),
  };
}
