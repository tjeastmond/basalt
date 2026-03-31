import { config } from "dotenv";
import { eq } from "drizzle-orm";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

config({ path: path.join(root, ".env.local") });
config({ path: path.join(root, ".env") });

const OWNER_EMAIL = "tj@test.com";
const OWNER_PASSWORD = "basalt";
const OWNER_NAME = "Basalt";

async function main() {
  const { db, getReadonlyDb, accessLevels, user, account } = await import("../src/db/index");
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

  const [existingUser] = await readDb.select().from(user).where(eq(user.email, OWNER_EMAIL)).limit(1);

  if (existingUser) {
    console.info("Seed skipped: default owner already exists (%s)", OWNER_EMAIL);
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

  console.info("Seeded default owner: %s (password: %s)", OWNER_EMAIL, OWNER_PASSWORD);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
