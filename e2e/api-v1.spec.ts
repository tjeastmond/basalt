import { expect, test } from "@playwright/test";

import { readSmokeApiKey, readSmokeUserApiKey } from "./helpers/api-key";

test.describe("api v1", () => {
  let ownerKey: string;
  let userKey: string;

  test.beforeAll(() => {
    ownerKey = readSmokeApiKey();
    userKey = readSmokeUserApiKey();
  });

  test("lists collections with owner key", async ({ request }) => {
    const res = await request.get("/api/v1/collections", {
      headers: { Authorization: `Bearer ${ownerKey}` },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { collections: unknown[] };
    expect(Array.isArray(body.collections)).toBe(true);
  });

  test("rejects unauthenticated requests", async ({ request }) => {
    const res = await request.get("/api/v1/collections");
    expect(res.status()).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("rejects invalid API key shape", async ({ request }) => {
    const res = await request.get("/api/v1/collections", {
      headers: { Authorization: "Bearer not-a-basalt-key" },
    });
    expect(res.status()).toBe(401);
  });

  test("rejects well-formed but wrong secret", async ({ request }) => {
    const forged = `${ownerKey.slice(0, -4)}xxxx`;
    const res = await request.get("/api/v1/collections", {
      headers: { Authorization: `Bearer ${forged}` },
    });
    expect(res.status()).toBe(401);
  });

  test("returns 404 for unknown collection slug", async ({ request }) => {
    const res = await request.get("/api/v1/collections/no_such_slug_e2e/records", {
      headers: { Authorization: `Bearer ${ownerKey}` },
    });
    expect(res.status()).toBe(404);
  });

  test("rejects malformed JSON on record create", async ({ request }) => {
    const res = await request.post("/api/v1/collections/posts/records", {
      headers: {
        Authorization: `Bearer ${ownerKey}`,
        "Content-Type": "application/json",
      },
      data: "{not-json",
    });
    expect(res.status()).toBe(400);
  });

  test("rejects invalid record body shape", async ({ request }) => {
    const res = await request.post("/api/v1/collections/posts/records", {
      headers: {
        Authorization: `Bearer ${ownerKey}`,
        "Content-Type": "application/json",
      },
      data: JSON.stringify({ values: [1, 2, 3] }),
    });
    expect(res.status()).toBe(400);
  });

  test("creates and deletes a record on posts", async ({ request }) => {
    const unique = `e2e-${Date.now()}`;
    const postRes = await request.post("/api/v1/collections/posts/records", {
      headers: {
        Authorization: `Bearer ${ownerKey}`,
        "Content-Type": "application/json",
      },
      data: {
        values: {
          title: `Title ${unique}`,
          slug: unique,
          body: "e2e body",
        },
      },
    });
    expect(postRes.status()).toBe(201);
    const created = (await postRes.json()) as { record: { id: string } };
    const id = created.record.id;
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);

    const getOne = await request.get(`/api/v1/collections/posts/records/${id}`, {
      headers: { Authorization: `Bearer ${ownerKey}` },
    });
    expect(getOne.status()).toBe(200);

    const patchRes = await request.patch(`/api/v1/collections/posts/records/${id}`, {
      headers: {
        Authorization: `Bearer ${ownerKey}`,
        "Content-Type": "application/json",
      },
      data: { values: { title: `Title ${unique} patched` } },
    });
    expect(patchRes.status()).toBe(200);

    const delRes = await request.delete(`/api/v1/collections/posts/records/${id}`, {
      headers: { Authorization: `Bearer ${ownerKey}` },
    });
    expect(delRes.status()).toBe(200);
  });

  test("user-level key cannot create records", async ({ request }) => {
    const res = await request.post("/api/v1/collections/posts/records", {
      headers: {
        Authorization: `Bearer ${userKey}`,
        "Content-Type": "application/json",
      },
      data: {
        values: {
          title: "Blocked",
          slug: `blocked-${Date.now()}`,
        },
      },
    });
    expect(res.status()).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/Admin or Owner API key/i);
  });
});
