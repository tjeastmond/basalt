import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { accessLevels, apiKeys, db, getPool } from "../src/db/index";
import { generateApiKeyPlaintext, hashApiKeySecret } from "../src/server/api-key-crypto";

const OWNER_LABEL = "playwright-smoke";
const USER_LABEL = "playwright-smoke-user";

async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set for e2e global setup (e.g. via .env.local).");
  }

  const [ownerLevel] = await db.select().from(accessLevels).where(eq(accessLevels.slug, "owner")).limit(1);
  const [userLevel] = await db.select().from(accessLevels).where(eq(accessLevels.slug, "user")).limit(1);

  if (!ownerLevel || !userLevel) {
    throw new Error("Expected access_levels rows for 'owner' and 'user' (run pnpm db:seed).");
  }

  await db.delete(apiKeys).where(eq(apiKeys.label, OWNER_LABEL));
  await db.delete(apiKeys).where(eq(apiKeys.label, USER_LABEL));

  async function insertKey(label: string, accessLevelId: string): Promise<string> {
    const plaintext = generateApiKeyPlaintext();
    const { keyPrefix, keySalt, keyHash } = hashApiKeySecret(plaintext);
    await db.insert(apiKeys).values({
      label,
      keyPrefix,
      keySalt,
      keyHash,
      accessLevelId,
      allowedCollectionIds: null,
    });
    return plaintext;
  }

  const ownerPlain = await insertKey(OWNER_LABEL, ownerLevel.id);
  const userPlain = await insertKey(USER_LABEL, userLevel.id);

  const e2eDir = path.resolve(process.cwd(), "e2e");
  fs.mkdirSync(e2eDir, { recursive: true, mode: 0o700 });
  const keyOpts = { encoding: "utf8" as const, mode: 0o600, flag: "w" as const };
  fs.writeFileSync(path.join(e2eDir, ".smoke-api-key"), ownerPlain, keyOpts);
  fs.writeFileSync(path.join(e2eDir, ".smoke-api-key-user"), userPlain, keyOpts);

  await getPool().end();
}

export default globalSetup;
