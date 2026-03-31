import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  RecordValidationError,
  deleteCollectionRecord,
  getCollectionRecord,
  insertCollectionRecord,
  listCollectionRecords,
  loadCollectionRecordsTarget,
  updateCollectionRecord,
} from "@/server/collection-records";
import { adminProcedure, router } from "@/server/api/trpc";

const recordValuesSchema = z.record(z.string(), z.unknown());

function mapRecordError(e: unknown): never {
  if (e instanceof RecordValidationError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
  }
  throw e;
}

async function requireTarget(collectionId: string) {
  const target = await loadCollectionRecordsTarget(collectionId);
  if (!target) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Collection not found." });
  }
  return target;
}

const listInput = z.object({
  collectionId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().max(500).optional(),
});

export const recordsRouter = router({
  list: adminProcedure.input(listInput).query(async ({ input }) => {
    const target = await requireTarget(input.collectionId);
    const limit = input.pageSize;
    const offset = (input.page - 1) * input.pageSize;
    try {
      return await listCollectionRecords(target, {
        limit,
        offset,
        search: input.search,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to list records.";
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
    }
  }),

  byId: adminProcedure
    .input(z.object({ collectionId: z.string().uuid(), id: z.string().uuid() }))
    .query(async ({ input }) => {
      const target = await requireTarget(input.collectionId);
      try {
        const row = await getCollectionRecord(target, input.id);
        if (!row) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Record not found." });
        }
        return row;
      } catch (e) {
        if (e instanceof TRPCError) {
          throw e;
        }
        const message = e instanceof Error ? e.message : "Failed to load record.";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),

  create: adminProcedure
    .input(
      z.object({
        collectionId: z.string().uuid(),
        values: recordValuesSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const target = await requireTarget(input.collectionId);
      try {
        return await insertCollectionRecord(target, input.values);
      } catch (e) {
        mapRecordError(e);
      }
    }),

  update: adminProcedure
    .input(
      z.object({
        collectionId: z.string().uuid(),
        id: z.string().uuid(),
        values: recordValuesSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const target = await requireTarget(input.collectionId);
      try {
        const row = await updateCollectionRecord(target, input.id, input.values);
        if (!row) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Record not found." });
        }
        return row;
      } catch (e) {
        if (e instanceof TRPCError) {
          throw e;
        }
        mapRecordError(e);
      }
    }),

  delete: adminProcedure
    .input(z.object({ collectionId: z.string().uuid(), id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const target = await requireTarget(input.collectionId);
      try {
        const ok = await deleteCollectionRecord(target, input.id);
        if (!ok) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Record not found." });
        }
        return { ok: true as const };
      } catch (e) {
        if (e instanceof TRPCError) {
          throw e;
        }
        const message = e instanceof Error ? e.message : "Failed to delete record.";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),
});
