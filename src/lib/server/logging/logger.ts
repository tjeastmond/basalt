import { existsSync, lstatSync, mkdirSync, readlinkSync, renameSync, statSync, symlinkSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";
import pino, { type DestinationStream, type Logger } from "pino";
import { readLogConfig } from "./config";
import { serializeError } from "./sanitize";
import type { LogContext, LogLevel } from "./types";

let rootLogger: Logger = pino({ level: "silent" });
let initPromise: Promise<void> | null = null;
let writeChain: Promise<void> = Promise.resolve();
let activeLogPath: string | null = null;

function createSilentLogger(): Logger {
  return pino({ level: "silent" });
}

function parseMaxBytes(maxSize: string): number {
  const match = maxSize.trim().match(/^([\d.]+)([kmgb]?)$/i);
  if (!match) return 5 * 1024 * 1024;

  const amount = Number.parseFloat(match[1] ?? "5");
  const unit = (match[2] ?? "m").toLowerCase();
  const multiplier = unit === "g" ? 1024 ** 3 : unit === "k" ? 1024 : unit === "b" ? 1 : 1024 ** 2;

  return Math.floor(amount * multiplier);
}

function rotateLogFiles(logDir: string, baseFile: string, maxFiles: number): string {
  const activePath = join(logDir, baseFile);

  for (let index = maxFiles; index >= 1; index -= 1) {
    const source = index === 1 ? activePath : join(logDir, `${baseFile}.${index - 1}`);
    const target = join(logDir, `${baseFile}.${index}`);
    if (!existsSync(source)) continue;
    if (existsSync(target)) unlinkSync(target);
    renameSync(source, target);
  }

  return activePath;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function symlinkTargetMatches(existingTarget: string, expectedTargetPath: string, logDir: string): boolean {
  const expectedBaseName = basename(expectedTargetPath);
  return (
    existingTarget === expectedTargetPath ||
    existingTarget === expectedBaseName ||
    existingTarget === join(logDir, expectedBaseName)
  );
}

function pathEntryExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function updateCurrentLogSymlink(logDir: string, targetPath: string): void {
  const linkPath = join(logDir, "current.log");
  const relativeTarget = basename(targetPath);

  if (pathEntryExists(linkPath)) {
    try {
      const stat = lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        const existingTarget = readlinkSync(linkPath);
        if (symlinkTargetMatches(existingTarget, targetPath, logDir)) {
          return;
        }
      }
    } catch {
      // Recreate the symlink below.
    }
    unlinkSync(linkPath);
  }

  try {
    symlinkSync(relativeTarget, linkPath, "file");
  } catch (error) {
    if (!isNodeError(error) || error.code !== "EEXIST" || !pathEntryExists(linkPath)) {
      throw error;
    }

    const stat = lstatSync(linkPath);
    if (!stat.isSymbolicLink()) {
      throw error;
    }

    const existingTarget = readlinkSync(linkPath);
    if (!symlinkTargetMatches(existingTarget, targetPath, logDir)) {
      throw error;
    }
  }
}

function maybeRotateLogFile(logDir: string, baseFile: string, maxBytes: number, maxFiles: number): string {
  const activePath = join(logDir, baseFile);
  if (!existsSync(activePath)) return activePath;

  const size = statSync(activePath).size;
  if (size < maxBytes) return activePath;

  const nextPath = rotateLogFiles(logDir, baseFile, maxFiles);
  return nextPath;
}

function createFileTransport(logDir: string, baseFile: string, maxBytes: number, maxFiles: number): DestinationStream {
  const logPath = maybeRotateLogFile(logDir, baseFile, maxBytes, maxFiles);
  activeLogPath = logPath;
  // Open the log file before creating the symlink so current.log never dangles.
  const stream = pino.destination({ dest: logPath, sync: true, mkdir: true });
  updateCurrentLogSymlink(logDir, logPath);

  return stream;
}

function write(level: LogLevel, message: string, context?: LogContext): void {
  writeChain = writeChain.then(() => writeAsync(level, message, context));
}

async function writeAsync(level: LogLevel, message: string, context?: LogContext): Promise<void> {
  await initLogger();
  if (level === "silent") return;

  const payload = context ?? {};
  switch (level) {
    case "debug":
      rootLogger.debug(payload, message);
      break;
    case "info":
      rootLogger.info(payload, message);
      break;
    case "warn":
      rootLogger.warn(payload, message);
      break;
    case "error":
      rootLogger.error(payload, message);
      break;
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

export async function initLogger(env: Record<string, string | undefined> = process.env): Promise<void> {
  if (!initPromise) {
    initPromise = Promise.resolve().then(() => {
      if (activeLogPath) {
        return;
      }

      const config = readLogConfig(env);

      if (!config.enabled) {
        rootLogger = createSilentLogger();
        return;
      }

      mkdirSync(config.dir, { recursive: true });

      if (env.LOG_TEST_FILE?.trim()) {
        activeLogPath = env.LOG_TEST_FILE.trim();
        rootLogger = pino({ level: config.level }, pino.destination({ dest: activeLogPath, sync: true, mkdir: true }));
        return;
      }

      const maxBytes = parseMaxBytes(config.maxSize);
      const transport = createFileTransport(config.dir, config.file, maxBytes, config.maxFiles);

      rootLogger = pino({ level: config.level }, transport);
      rootLogger.debug(
        { logDir: config.dir, file: config.file, maxSize: config.maxSize, maxFiles: config.maxFiles },
        "log file ready",
      );
    });
  }

  await initPromise;
}

export async function flushLogs(): Promise<void> {
  await writeChain;
  await initLogger();
  await new Promise<void>((resolve) => {
    rootLogger.flush(() => resolve());
  });
}

export function resetLoggerForTests(): void {
  rootLogger = createSilentLogger();
  initPromise = null;
  writeChain = Promise.resolve();
  activeLogPath = null;
}

export const log = {
  debug(message: string, context?: LogContext): void {
    write("debug", message, context);
  },
  info(message: string, context?: LogContext): void {
    write("info", message, context);
  },
  warn(message: string, context?: LogContext): void {
    write("warn", message, context);
  },
  error(message: string, context?: LogContext): void {
    write("error", message, context);
  },
  errorFromUnknown(error: unknown, context?: LogContext): void {
    const serialized = serializeError(error);
    write("error", serialized.message, { ...(context ?? {}), error: serialized });
  },
};

export function getActiveLogPathForTests(): string | null {
  return activeLogPath;
}
