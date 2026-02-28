-- ApiKeyStore: support multiple keys per provider and explicit active key selection
ALTER TABLE "ApiKeyStore"
ADD COLUMN "keyName" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT false;

-- Existing one-key-per-provider rows should remain usable immediately
UPDATE "ApiKeyStore"
SET "isActive" = true
WHERE "isActive" = false;

DROP INDEX IF EXISTS "ApiKeyStore_companyId_provider_key";

CREATE UNIQUE INDEX "ApiKeyStore_companyId_provider_keyName_key"
ON "ApiKeyStore"("companyId", "provider", "keyName");

CREATE INDEX "ApiKeyStore_companyId_provider_isActive_idx"
ON "ApiKeyStore"("companyId", "provider", "isActive");
