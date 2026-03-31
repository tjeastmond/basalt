ALTER INDEX "account_userId_idx" RENAME TO "accounts_userId_idx";--> statement-breakpoint
ALTER INDEX "session_userId_idx" RENAME TO "sessions_userId_idx";--> statement-breakpoint
ALTER TABLE "user" RENAME TO "users";--> statement-breakpoint
ALTER TABLE "session" RENAME TO "sessions";--> statement-breakpoint
ALTER TABLE "account" RENAME TO "accounts";
