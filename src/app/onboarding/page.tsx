import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { OnboardingClient } from "@/app/onboarding/onboarding-client";
import { getMemberFromHeaders } from "@/lib/member";

export default async function OnboardingPage() {
  const member = await getMemberFromHeaders(await headers());
  if (!member) {
    redirect("/login");
  }
  if (member.onboardingCompletedAt) {
    redirect("/");
  }
  return <OnboardingClient />;
}
