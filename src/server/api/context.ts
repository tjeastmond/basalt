import type { Member } from "@/lib/member";
import { getMemberFromHeaders } from "@/lib/member";

export type TRPCContext = {
  headers: Headers;
  member: Member | null;
};

export async function createTRPCContext(opts: { headers: Headers }): Promise<TRPCContext> {
  const member = await getMemberFromHeaders(opts.headers);
  return {
    headers: opts.headers,
    member,
  };
}
