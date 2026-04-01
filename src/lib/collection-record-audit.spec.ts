import { describe, expect, it } from "vitest";

import { formatRecordActorLabel, formatRecordAuditTimestamp } from "@/lib/collection-record-audit";

describe("formatRecordAuditTimestamp", () => {
  it("formats Date and ISO strings", () => {
    expect(formatRecordAuditTimestamp(new Date("2024-06-01T12:34:56.000Z"))).toBe("2024-06-01 12:34:56");
    expect(formatRecordAuditTimestamp("2024-06-01T12:34:56.000Z")).toBe("2024-06-01 12:34:56");
  });

  it("returns em dash for nullish", () => {
    expect(formatRecordAuditTimestamp(null)).toBe("—");
    expect(formatRecordAuditTimestamp(undefined)).toBe("—");
  });
});

describe("formatRecordActorLabel", () => {
  it("labels api_key-prefixed refs", () => {
    expect(formatRecordActorLabel("api_key:aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee")).toBe("API key aaaaaaaa…");
  });

  it("returns raw user ids and em dash for empty", () => {
    expect(formatRecordActorLabel("user_01abc")).toBe("user_01abc");
    expect(formatRecordActorLabel(null)).toBe("—");
  });
});
