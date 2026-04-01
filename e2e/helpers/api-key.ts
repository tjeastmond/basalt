import fs from "node:fs";
import path from "node:path";

export function readSmokeApiKey(): string {
  const p = path.resolve(process.cwd(), "e2e", ".smoke-api-key");
  return fs.readFileSync(p, "utf8").trim();
}

export function readSmokeUserApiKey(): string {
  const p = path.resolve(process.cwd(), "e2e", ".smoke-api-key-user");
  return fs.readFileSync(p, "utf8").trim();
}
