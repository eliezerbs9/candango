-- Custom fields: required + conditional-required (stage / won) config. (New types image/document
-- are string values, no column change.)
ALTER TABLE "CustomFieldDefinition" ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CustomFieldDefinition" ADD COLUMN "requiredFromStageId" TEXT;
ALTER TABLE "CustomFieldDefinition" ADD COLUMN "requiredForWon" BOOLEAN NOT NULL DEFAULT false;
