CREATE TABLE IF NOT EXISTS "discovery_metric" (
  "day" date NOT NULL,
  "event" text NOT NULL CHECK ("event" IN ('impression', 'click')),
  "placement" text NOT NULL CHECK ("placement" IN ('featured', 'grid', 'task')),
  "target" text NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("day", "event", "placement", "target")
);
