import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { loadProjectEnvFiles } from "@/lib/server/loadEnvFile";
import { flushLogs, initLogger, log } from "@/lib/server/logging/logger";

loadProjectEnvFiles();

const OWNER_EMAIL = "tj@test.com";
const OWNER_PASSWORD = "basalt";
const OWNER_NAME = "Basalt";

async function main() {
  await initLogger();

  const [{ db, getReadonlyDb, accessLevels, user, account }, { ensurePostsCollectionAndSampleData }] =
    await Promise.all([import("../src/db/index"), import("../src/server/seed-posts-collection")]);
  const readDb = getReadonlyDb();

  await db
    .insert(accessLevels)
    .values([
      { slug: "owner", label: "Owner", sortOrder: 0 },
      { slug: "admin", label: "Admin", sortOrder: 1 },
      { slug: "user", label: "User", sortOrder: 2 },
    ])
    .onConflictDoNothing({ target: accessLevels.slug });

  const [ownerLevel] = await readDb.select().from(accessLevels).where(eq(accessLevels.slug, "owner")).limit(1);

  if (!ownerLevel) {
    throw new Error("Expected access level 'owner' after seed");
  }

  await ensurePostsCollectionAndSampleData();

  const [existingUser] = await readDb.select().from(user).where(eq(user.email, OWNER_EMAIL)).limit(1);

  if (existingUser) {
    log.info("seed skipped: default owner already exists", { email: OWNER_EMAIL });
    return;
  }

  const userId = randomUUID();
  const accountId = randomUUID();
  const passwordHash = await hashPassword(OWNER_PASSWORD);

  await db.insert(user).values({
    id: userId,
    name: OWNER_NAME,
    email: OWNER_EMAIL,
    emailVerified: true,
    image: null,
    accessLevelId: ownerLevel.id,
    onboardingCompletedAt: null,
  });

  await db.insert(account).values({
    id: accountId,
    accountId: userId,
    providerId: "credential",
    userId,
    password: passwordHash,
  });

  log.info("seeded default owner", { email: OWNER_EMAIL });
}

main()
  .catch(async (err) => {
    await initLogger();
    log.errorFromUnknown(err, { script: "seed-owner" });
    await flushLogs();
    process.exit(1);
  })
  .finally(async () => {
    await flushLogs();
  });
