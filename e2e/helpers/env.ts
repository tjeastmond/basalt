export function smokeCredentials(): { email: string; password: string } {
  const email = process.env.SMOKE_EMAIL ?? "tj@test.com";
  const password = process.env.SMOKE_PASSWORD;
  if (!password) {
    throw new Error("SMOKE_PASSWORD is required for browser e2e (set in .env.local).");
  }
  return { email, password };
}
