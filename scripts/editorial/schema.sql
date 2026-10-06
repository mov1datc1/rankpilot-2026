-- Additive migration; leaves existing submissions and drafts intact.
CREATE TABLE IF NOT EXISTS "EditorialJob" (
  "id" text PRIMARY KEY,
  "submissionId" text NOT NULL REFERENCES "Submission"("id") ON DELETE CASCADE,
  "userId" text NOT NULL,
  "sourceHash" text NOT NULL,
  "snapshot" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'queued',
  "tasks" jsonb NOT NULL DEFAULT '["selection"]',
  "cursor" integer NOT NULL DEFAULT 0,
  "stage" text NOT NULL DEFAULT 'selection',
  "leaseToken" text,
  "leaseUntil" timestamptz,
  "ledger" jsonb NOT NULL DEFAULT '[]',
  "issue" jsonb,
  "resultHash" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "EditorialJob_one_active" ON "EditorialJob" ("submissionId") WHERE "status" IN ('queued','running');
CREATE INDEX IF NOT EXISTS "EditorialJob_queue" ON "EditorialJob" ("status","createdAt");
CREATE INDEX IF NOT EXISTS "EditorialJob_owner" ON "EditorialJob" ("userId","submissionId","createdAt");
CREATE TABLE IF NOT EXISTS "EditorialWorker" (
  "id" text PRIMARY KEY,
  "version" text NOT NULL,
  "heartbeat" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "EditorialJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EditorialWorker" ENABLE ROW LEVEL SECURITY;
