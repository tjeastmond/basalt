import { lstatSync, mkdtempSync, readlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushLogs, initLogger, log, resetLoggerForTests } from "@/lib/server/logging/logger";

describe("logger symlink", () => {
  let tempDir = "";

  beforeEach(() => {
    resetLoggerForTests();
    tempDir = mkdtempSync(join(tmpdir(), "basalt-log-symlink-"));
    process.env.LOG_ENABLED = "true";
    process.env.LOG_LEVEL = "info";
    process.env.LOG_DIR = tempDir;
    process.env.LOG_FILE = "basalt.log";
    process.env.VITEST = "false";
    delete process.env.LOG_TEST_FILE;
  });

  afterEach(async () => {
    await flushLogs().catch(() => undefined);
    resetLoggerForTests();
    delete process.env.VITEST;
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("creates current.log once and tolerates re-init", async () => {
    await initLogger();
    log.info("first init");
    await flushLogs();

    const linkPath = join(tempDir, "current.log");
    expect(lstatSync(linkPath).isSymbolicLink()).toBe(true);
    expect(readlinkSync(linkPath)).toBe("basalt.log");

    resetLoggerForTests();
    await initLogger();
    log.info("second init");
    await flushLogs();

    expect(lstatSync(linkPath).isSymbolicLink()).toBe(true);
    expect(readlinkSync(linkPath)).toBe("basalt.log");
  });
});
