-- Deal tags (labels/flags) — used for filtering + the pipeline card.
ALTER TABLE "Deal" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Workspace-level config for which elements show on a pipeline deal card.
ALTER TABLE "Organization" ADD COLUMN "dealCardConfig" JSONB NOT NULL DEFAULT '{}';
