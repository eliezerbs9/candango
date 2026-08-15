-- Win Requirements: rules that gate a deal's "Mark won" button (global per workspace).
-- {} (default) or { enabled: false } => "Any time" (no gating beyond existing required fields).
ALTER TABLE "Organization" ADD COLUMN "winRequirements" JSONB NOT NULL DEFAULT '{}';
