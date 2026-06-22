import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readLogConfig } from "@/lib/server/logging/config";
import { flushLogs, initLogger, log, resetLoggerForTests } from "@/lib/server/logging/logger";

function parseLogLines(contents: string): Array<Record<string, unknown>> {
  return contents
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("readLogConfig", () => {
  it("defaults to info level and enabled outside vitest", () => {
    const config = readLogConfig({
      LOG_ENABLED: "true",
      LOG_LEVEL: "info",
    });

    expect(config.enabled).toBe(true);
    expect(config.level).toBe("info");
    expect(config.file).toBe("basalt.log");
    expect(config.maxSize).toBe("5m");
    expect(config.maxFiles).toBe(7);
  });

  it("disables logging during vitest by default", () => {
    const config = readLogConfig({ VITEST: "true" });
    expect(config.enabled).toBe(false);
  });

  it("honors explicit LOG_ENABLED during vitest", () => {
    const config = readLogConfig({ VITEST: "true", LOG_ENABLED: "true" });
    expect(config.enabled).toBe(true);
  });
});

describe("logger", () => {
  let tempDir = "";
  let testLogFile = "";

  beforeEach(() => {
    resetLoggerForTests();
    tempDir = mkdtempSync(join(tmpdir(), "basalt-log-"));
    testLogFile = join(tempDir, "test.log");
    process.env.LOG_ENABLED = "true";
    process.env.LOG_LEVEL = "debug";
    process.env.LOG_DIR = tempDir;
    process.env.LOG_FILE = "basalt.log";
    process.env.LOG_TEST_FILE = testLogFile;
    process.env.LOG_MAX_SIZE = "5m";
    process.env.LOG_MAX_FILES = "3";
  });

  afterEach(async () => {
    await flushLogs().catch(() => undefined);
    resetLoggerForTests();
    delete process.env.LOG_TEST_FILE;
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("writes info and error lines to the log file", async () => {
    await initLogger();
    log.info("collection created", { id: "abc-123" });
    log.error("seed failed", { reason: "missing owner level" });
    await flushLogs();

    const lines = parseLogLines(readFileSync(testLogFile, "utf8"));

    expect(lines.some((line) => line.msg === "collection created" && line.id === "abc-123")).toBe(true);
    expect(lines.some((line) => line.msg === "seed failed" && line.reason === "missing owner level")).toBe(true);
  });

  it("respects LOG_LEVEL filtering", async () => {
    process.env.LOG_LEVEL = "warn";
    resetLoggerForTests();
    await initLogger();

    log.debug("debug detail");
    log.info("info detail");
    log.warn("warn detail");
    await flushLogs();

    const messages = parseLogLines(readFileSync(testLogFile, "utf8")).map((line) => line.msg);

    expect(messages).not.toContain("debug detail");
    expect(messages).not.toContain("info detail");
    expect(messages).toContain("warn detail");
  });

  it("does not write when logging is disabled", async () => {
    process.env.LOG_ENABLED = "false";
    resetLoggerForTests();
    await initLogger();

    log.error("should not appear");
    await flushLogs();

    expect(existsSync(testLogFile)).toBe(false);
  });
});
