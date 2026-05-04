-- Wave 4 backlog: persist audio/video durationSec and image tags on File.
--
-- durationSec: nullable Float (DOUBLE PRECISION). Only populated for audio
-- and video files after Whisper transcription returns segment metadata.
-- Nullable because "no duration computed yet" is semantically different from 0.
--
-- tags: non-nullable TEXT[] with DEFAULT empty array. Populated by the image
-- handler (Gemini Vision returns tags). Defaults to empty array so application
-- code never has to handle null (just check .length).
--
-- DZ-2 SAFE: Does not touch search_vector trigger or ContextEntry columns.

ALTER TABLE "File" ADD COLUMN "durationSec" DOUBLE PRECISION;
ALTER TABLE "File" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
