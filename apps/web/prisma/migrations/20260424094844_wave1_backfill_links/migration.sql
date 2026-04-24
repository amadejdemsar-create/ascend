-- Backfill ContextLink rows from existing ContextEntry.linkedEntryIds arrays.
-- Each entry in linkedEntryIds becomes a REFERENCES edge with CONTENT source.
-- Idempotent: ON CONFLICT DO NOTHING means running twice is safe.
-- Orphaned references (linkedEntryIds pointing to deleted entries) are filtered out.

INSERT INTO "ContextLink" (id, "userId", "fromEntryId", "toEntryId", type, source, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  e."userId",
  e.id,
  linked_id,
  'REFERENCES',
  'CONTENT',
  now(),
  now()
FROM "ContextEntry" e,
     unnest(e."linkedEntryIds") AS linked_id
WHERE linked_id IN (SELECT id FROM "ContextEntry")
ON CONFLICT ("fromEntryId", "toEntryId", type) DO NOTHING;
