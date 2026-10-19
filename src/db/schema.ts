/**
 * Signal Garden — database schema
 *
 * Written against the Postgres dialect and run locally on PGlite (WASM
 * Postgres). That means the same file, the same migrations and the same
 * queries work in development and in production — there is no second dialect
 * to keep in sync.
 *
 * Three layers, in dependency order:
 *
 *   1. source_signal                      raw, never rendered
 *   2. project / skill / snapshot / ...   normalised, deduped, rendered
 *   3. daily_signal / ai_content          per-day derived, rendered
 *
 * The load-bearing rule: a heat score belongs to (project × date), not to a
 * project. It lives only in daily_signal. project.heat_score_latest is a
 * denormalised sort cache and must never be shown as if it were current
 * without also reading `as_of`.
 */

import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { InstallCommand, RiskFlag } from "../parsers/types";

/** Origin hits for the public read API. One row per path per site day. */
export const apiRequestDaily = pgTable("api_request_daily", {
  day: date("day").notNull(),
  path: text("path").notNull(),
  count: integer("count").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.day, t.path] })]);

/** Successful IndexNow pings. The same payload is not sent twice in one day. */
export const indexnowSubmission = pgTable("indexnow_submission", {
  day: date("day").notNull(),
  payloadHash: text("payload_hash").notNull(),
  status: integer("status").notNull(),
  urlCount: integer("url_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.day, t.payloadHash] })]);

/** Daily homepage counters. Deliberately contains no visitor identifiers. */
export const discoveryMetric = pgTable('discovery_metric', {
  day: date('day').notNull(),
  event: text('event').notNull(),
  placement: text('placement').notNull(),
  target: text('target').notNull(),
  count: integer('count').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.day, t.event, t.placement, t.target] })]);

/* ===========================================================================
   Enums
   ======================================================================== */

export const sourceEnum = pgEnum("source", [
  "github",
  "hackernews",
  "producthunt",
  "community",
]);

export const projectKindEnum = pgEnum("project_kind", [
  "repo",
  "product",
  "story_derived",
]);

export const linkStatusEnum = pgEnum("link_status", [
  "ok",
  "dead",
  "redirect",
  "unknown",
]);

/** The ten launch categories. Keys must match data-category in tokens.css. */
export const categoryEnum = pgEnum("category", [
  "skill",
  "agent",
  "devtool",
  "design",
  "browser",
  "media",
  "data",
  "productivity",
  "security",
  "marketing",
]);

export const difficultyEnum = pgEnum("difficulty", [
  "one_click",
  "simple_config",
  "needs_api_key",
  "needs_local",
  "needs_dev",
  "expert",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "new",
  "surging",
  "steady",
  "slowing",
  "unstable",
  "stale",
  "archived",
  "unverified", // failed a pre-publish gate; archive only, never ranked
]);

export const securityLevelEnum = pgEnum("security_level", [
  "safe",
  "review",
  "risk",
  "unknown",
]);

export const parseStateEnum = pgEnum("parse_state", [
  "pending",
  "parsed",
  "failed",
]);

export const skillTypeEnum = pgEnum("skill_type", [
  "skill",
  "mcp",
  "agent",
  "prompt_pack",
  "workflow",
  "library",
  "framework",
  "template",
  "unknown",
]);

export const recommendationEnum = pgEnum("recommendation", [
  "try",
  "watch",
  "caution",
  "avoid",
]);

export const saveTargetEnum = pgEnum("save_target", ["project", "skill"]);

export const subscriptionKindEnum = pgEnum("subscription_kind", [
  "category",
  "keyword",
  "platform",
]);

export const feedbackKindEnum = pgEnum("feedback_kind", [
  "dead_link",
  "wrong_category",
  "inaccurate_desc",
  "security_risk",
  "unmaintained",
]);

export const feedbackStatusEnum = pgEnum("feedback_status", [
  "pending",
  "reviewed",
  "rejected",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "running",
  "ok",
  "failed",
  "skipped",
]);

/**
 * Daily-digest list. Separate from `subscriptions` (paid plans) and
 * `user_subscription` (category filters).
 */
export const newsletterStatusEnum = pgEnum("newsletter_status", [
  "pending",
  "active",
  "unsubscribed",
  "bounced",
  "complained",
]);

export const newsletterSendStatusEnum = pgEnum("newsletter_send_status", [
  "queued",
  "sent",
  "failed",
  "bounced",
]);

/* ===========================================================================
   Layer 1 — raw source signals
   Every fetch lands here first, keyed on a content hash so re-fetching an
   unchanged payload is a no-op rather than a write.
   ======================================================================== */

export const sourceSignal = pgTable(
  "source_signal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: sourceEnum("source").notNull(),
    /** Native id: GitHub node id, HN objectID, PH slug. */
    sourceId: text("source_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    /** sha256(payload) — dedupe key for re-fetches. */
    rawHash: text("raw_hash").notNull(),
    payload: jsonb("payload").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    /** Set when normalisation rejects the row; kept for debugging. */
    rejectedReason: text("rejected_reason"),
  },
  (t) => [
    unique("source_signal_uniq").on(t.source, t.sourceId, t.rawHash),
    index("source_signal_unprocessed_idx").on(t.processedAt, t.fetchedAt),
    index("source_signal_source_idx").on(t.source, t.fetchedAt),
  ],
);

/* ===========================================================================
   Layer 2 — normalised projects
   ======================================================================== */

export const project = pgTable(
  "project",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Dedupe key, resolved in strict order:
     *   github repo id > canonical url > domain > ph slug > name+owner
     * Format is prefixed, e.g. "gh:12345678", "domain:example.com".
     */
    canonicalProjectId: text("canonical_project_id").notNull(),
    slug: text("slug").notNull(),

    name: text("name").notNull(),
    owner: text("owner"),
    fullName: text("full_name"), // "anthropics/skills"

    primaryUrl: text("primary_url").notNull(),
    domain: text("domain"),

    /** Vendor-written description. Never our AI text. */
    description: text("description"),

    projectKind: projectKindEnum("project_kind").notNull().default("repo"),

    /** Lineage — forks and mirrors must not rank as independent projects. */
    forkOf: text("fork_of"),
    mirrorOf: text("mirror_of"),
    duplicateOf: text("duplicate_of"),

    isArchived: boolean("is_archived").notNull().default(false),
    /** Operator override. Hidden projects never render anywhere. */
    hidden: boolean("hidden").notNull().default(false),

    linkStatus: linkStatusEnum("link_status").notNull().default("unknown"),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),

    category: categoryEnum("category"),
    /** V2 taxonomy: six primaries, each with a second level. */
    primaryCategory: text("primary_category"),
    secondaryCategory: text("secondary_category"),
    tags: text("tags").array().notNull().default([]),

    difficulty: difficultyEnum("difficulty"),
    status: projectStatusEnum("status").notNull().default("new"),

    license: text("license"), // SPDX id when known
    pricing: text("pricing"),

    requiresApiKey: boolean("requires_api_key").notNull().default(false),
    requiresLocalRuntime: boolean("requires_local_runtime")
      .notNull()
      .default(false),
    requiresDocker: boolean("requires_docker").notNull().default(false),

    securityLevel: securityLevelEnum("security_level")
      .notNull()
      .default("unknown"),

    parseState: parseStateEnum("parse_state").notNull().default("pending"),
    /** sha256 of README + manifests; re-parse only when this changes. */
    contentHash: text("content_hash"),
    lastError: text("last_error"),

    /* --- Derived caches. Rebuilt by the score job; not the source of truth. */
    heatScoreLatest: real("heat_score_latest").notNull().default(0),
    heatComputedAt: timestamp("heat_computed_at", { withTimezone: true }),
    qualityGrade: varchar("quality_grade", { length: 4 }),

    /* --- Source-native metrics, refreshed hourly by the enrich job. */
    stars: integer("stars").notNull().default(0),
    forks: integer("forks").notNull().default(0),
    openIssues: integer("open_issues").notNull().default(0),

    /* --- GitHub identity (Phase 1). node id is stable across renames. */
    githubNodeId: text("github_node_id"),
    defaultBranch: text("default_branch"),
    homepageUrl: text("homepage_url"),
    language: text("language"),
    topics: text("topics").array().notNull().default([]),
    isTemplate: boolean("is_template").notNull().default(false),

    /* --- Provenance (brief section 十八). */
    sourceUrl: text("source_url"),
    rawDataHash: text("raw_data_hash"),
    /** Every discovery query that surfaced this repo. */
    discoveryQueries: text("discovery_queries").array().notNull().default([]),
    /** SKILL.md paths seen by code search, used to prioritise parsing. */
    codeHitPaths: text("code_hit_paths").array().notNull().default([]),
    metaRefreshedAt: timestamp("meta_refreshed_at", { withTimezone: true }),
    headSha: text("head_sha"),
    parsedHeadSha: text("parsed_head_sha"),
    parsedAt: timestamp("parsed_at", { withTimezone: true }),
    aiGeneratedAt: timestamp("ai_generated_at", { withTimezone: true }),
    commits7d: integer("commits_7d").notNull().default(0),
    /** Distinct contributors, refreshed with the GitHub metadata pass. */
    contributors: integer("contributors").notNull().default(0),

    /* --- Parsed facts (Phase 1). Only what the files state. */
    readmeText: text("readme_text"),
    readmeHash: text("readme_hash"),
    skillType: skillTypeEnum("skill_type").notNull().default("unknown"),
    skillConfidence: real("skill_confidence").notNull().default(0),
    isVerifiedSkill: boolean("is_verified_skill").notNull().default(false),
    hasSkillMd: boolean("has_skill_md").notNull().default(false),
    skillCount: integer("skill_count").notNull().default(0),
    /** A corpus of Skills (a registry), not a single installable project. */
    isSkillCollection: boolean("is_skill_collection").notNull().default(false),
    supportedAgents: text("supported_agents").array().notNull().default([]),
    installCommands: jsonb("install_commands").$type<InstallCommand[]>().notNull().default([]),
    /** null = never scanned; [] = scanned, nothing matched. */
    riskFlags: jsonb("risk_flags").$type<RiskFlag[] | null>(),
    docSignals: jsonb("doc_signals"),
    /** Where each parsed fact came from — the audit trail behind the UI. */
    parseEvidence: jsonb("parse_evidence"),
    /** "rules" | "ai" | "admin". Admin choices are never overwritten. */
    categorySource: varchar("category_source", { length: 8 }),
    /** Set when the repo is an obvious junk / empty repository. */
    junkReason: text("junk_reason"),

    /* --- Editorial focus (src/normalizers/focus.ts). */
    focusThemes: text("focus_themes").array().notNull().default([]),
    focusScore: integer("focus_score").notNull().default(0),
    focusEvidence: jsonb("focus_evidence"),

    /* --- Growth metrics. Heat ranking uses stars24h/stars7d from our own
       repo_snapshot rows. forks7d is a separate card metric and growth-gate
       input, measured from fork timestamps. */
    forks24h: integer("forks_24h"),
    forks7d: integer("forks_7d"),
    forks30d: integer("forks_30d"),
    stars24h: integer("stars_24h"),
    stars7d: integer("stars_7d"),
    growthMeasuredAt: timestamp("growth_measured_at", { withTimezone: true }),
    /** Last time the HN discussion collector looked at this project. */
    mentionsCheckedAt: timestamp("mentions_checked_at", { withTimezone: true }),
    /** Met the editorial floor on a later run than its first sighting. */
    isRising: boolean("is_rising").notNull().default(false),
    firstTrackedAt: timestamp("first_tracked_at", { withTimezone: true }),
    /** GitHub's own repository card. Generated by GitHub, so no scraping. */
    previewImageUrl: text("preview_image_url"),

    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Vendor's own creation date, distinct from when we found it. */
    upstreamCreatedAt: timestamp("upstream_created_at", { withTimezone: true }),
    upstreamPushedAt: timestamp("upstream_pushed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("project_canonical_uniq").on(t.canonicalProjectId),
    unique("project_slug_uniq").on(t.slug),
    index("project_rank_idx").on(t.category, t.heatScoreLatest),
    index("project_status_idx").on(t.status),
    index("project_parse_idx").on(t.parseState),
    index("project_updated_idx").on(t.updatedAt),
    index("project_meta_idx").on(t.metaRefreshedAt),
    index("project_focus_idx").on(t.focusScore),
    index("project_primary_idx").on(t.primaryCategory),
    index("project_growth_idx").on(t.growthMeasuredAt),
    index("project_readme_hash_idx").on(t.readmeHash),
  ],
);

/**
 * One SKILL.md = one row. A repo of many skills is one project with many
 * skill rows (anthropics/skills -> frontend-design, pdf, spreadsheets, ...).
 */
export const skill = pgTable(
  "skill",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),

    /** 0–1 evidence-weighted classification confidence. */
    skillConfidence: real("skill_confidence").notNull().default(0),
    skillType: skillTypeEnum("skill_type").notNull().default("unknown"),
    isVerifiedSkill: boolean("is_verified_skill").notNull().default(false),
    hasSkillMd: boolean("has_skill_md").notNull().default(false),
    hasInstallation: boolean("has_installation").notNull().default(false),

    /** Only platforms proven by the parser, never inferred by the model. */
    supportedAgents: text("supported_agents").array().notNull().default([]),

    /** Raw YAML frontmatter from SKILL.md. */
    frontmatter: jsonb("frontmatter"),
    /** Path within the repo, e.g. "skills/frontend-design/SKILL.md". */
    sourcePath: text("source_path"),
    bodyExcerpt: text("body_excerpt"),

    installMethod: text("install_method"),
    contentHash: text("content_hash"),
    description: text("description"),
    riskFlags: jsonb("risk_flags").$type<RiskFlag[]>().notNull().default([]),
    focusThemes: text("focus_themes").array().notNull().default([]),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("skill_project_slug_uniq").on(t.projectId, t.slug),
    index("skill_type_idx").on(t.skillType),
    index("skill_confidence_idx").on(t.skillConfidence),
  ],
);

/**
 * Daily metric snapshots. The trends page reads only from here — a trend must
 * come from genuinely captured history, never from a curve fitted after the
 * fact.
 */
export const repoSnapshot = pgTable(
  "repo_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),

    stars: integer("stars").notNull().default(0),
    forks: integer("forks").notNull().default(0),
    openIssues: integer("open_issues").notNull().default(0),
    watchers: integer("watchers").notNull().default(0),
    commits7d: integer("commits_7d").notNull().default(0),
    releases30d: integer("releases_30d").notNull().default(0),
    contributors: integer("contributors").notNull().default(0),

    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("snapshot_project_time_idx").on(t.projectId, t.capturedAt),
  ],
);

/** HN threads, PH launches, blog posts — the external-discussion signal. */
export const externalMention = pgTable(
  "external_mention",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),

    source: varchar("source", { length: 32 }).notNull(), // hackernews | producthunt | ...
    url: text("url").notNull(),
    title: text("title"),
    author: text("author"),
    points: integer("points").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    isShowHn: boolean("is_show_hn").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("mention_uniq").on(t.projectId, t.source, t.url),
    index("mention_published_idx").on(t.publishedAt),
  ],
);

/* ===========================================================================
   Layer 3 — derived per-day output
   ======================================================================== */

export const dailySignal = pgTable(
  "daily_signal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    signalDate: date("signal_date").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    /** Set when the signal is about one specific skill rather than the repo. */
    skillId: uuid("skill_id").references(() => skill.id, {
      onDelete: "set null",
    }),

    rank: integer("rank").notNull(),
    heatScore: real("heat_score").notNull(),

    /**
     * Full scoring transparency:
     * { metrics: {...}, normalized: {...}, weighted: {...}, corrections: [{code, factor, note}] }
     * The UI renders `reason` and can expand into this.
     */
    breakdown: jsonb("breakdown").notNull(),

    /** Auto-generated Chinese sentence: why this is on the list today. */
    reason: text("reason"),

    /** '24h' | '7d' — every percentage shown in the UI carries one of these. */
    window: varchar("window", { length: 8 }).notNull().default("7d"),

    isPublished: boolean("is_published").notNull().default(false),
    /** Excluded from public ranking pending human review (e.g. score spike). */
    needsReview: boolean("needs_review").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("daily_signal_uniq").on(t.signalDate, t.projectId),
    index("daily_signal_rank_idx").on(t.signalDate, t.rank),
    index("daily_signal_published_idx").on(t.isPublished, t.signalDate),
  ],
);

export const aiContent = pgTable(
  "ai_content",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 8 }).notNull().default("zh"),

    /** 30–60 Chinese characters. Enforced by the guard, not by hope. */
    oneLiner: text("one_liner"),
    /** 100–150 Chinese characters. */
    problem: text("problem"),

    /**
     * V2 hook: the one line that makes someone stop. Four shapes, chosen per
     * project — a number, a counter-intuitive claim, a group, or a comparison.
     * Generated per language rather than translated, because the shapes do not
     * survive literal translation.
     */
    hook: text("hook"),
    hookType: text("hook_type"),

    /**
     * V2 §6 Pattern block: who uses this and in what situation. Abstract
     * identities only — the brief forbids real companies or real job titles,
     * and forbids the kind of invented hero quote the reference image shows.
     * [{ persona, scenario }]
     */
    personas: jsonb("personas").$type<{ persona: string; scenario: string }[]>().notNull().default([]),

    targetUsers: text("target_users").array().notNull().default([]),
    whyNow: jsonb("why_now").$type<string[]>().notNull().default([]),
    notFor: jsonb("not_for").$type<string[]>().notNull().default([]),
    limits: jsonb("limits").$type<string[]>().notNull().default([]),

    /**
     * Consumer-facing capabilities: 3–5 short outcome statements derived from
     * README / SKILL.md evidence. The row's `locale` determines language, so
     * this column intentionally has no language suffix.
     */
    capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),

    installHint: text("install_hint"),
    riskNote: text("risk_note"),

    recommendation: recommendationEnum("recommendation")
      .notNull()
      .default("watch"),

    /**
     * Provenance for every assertion:
     * [{ field, claim, source: 'readme'|'github_api'|'skill_md', ref }]
     * The detail page exposes this behind "为什么这么说".
     */
    evidence: jsonb("evidence"),

    /** Set false by the guard when any check fails; UI then labels the block. */
    passedGuard: boolean("passed_guard").notNull().default(false),
    guardFailures: jsonb("guard_failures").$type<string[]>().default([]),

    model: text("model"),
    promptVersion: text("prompt_version"),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    verifiedByHuman: boolean("verified_by_human").notNull().default(false),
  },
  (t) => [
    unique("ai_content_uniq").on(t.projectId, t.locale),
    index("ai_content_reco_idx").on(t.recommendation),
  ],
);

/* ===========================================================================
   Users.
   v1 ships anonymous local saves; these tables exist but stay unused until
   accounts are enabled, at which point local saves merge upward.
   ======================================================================== */

export const user = pgTable(
  "user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    locale: varchar("locale", { length: 8 }).notNull().default("zh"),
    digestEnabled: boolean("digest_enabled").notNull().default(false),
    digestHour: integer("digest_hour").notNull().default(8),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("user_email_uniq").on(t.email)],
);

export const userSave = pgTable(
  "user_save",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetType: saveTargetEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("user_save_uniq").on(t.userId, t.targetType, t.targetId),
    index("user_save_user_idx").on(t.userId, t.createdAt),
  ],
);

export const userSubscription = pgTable(
  "user_subscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: subscriptionKindEnum("kind").notNull(),
    value: text("value").notNull(),
    /** Set for mute-style subscriptions (关闭某类项目). */
    muted: boolean("muted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("user_sub_uniq").on(t.userId, t.kind, t.value)],
);

/**
 * Feedback only ever queues for review; it never mutates public content and
 * never touches the project row directly.
 */
/** Supabase Auth user id is the primary key; no password is ever stored here. */
export const profile = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().unique(),
    username: text("username"),
    avatarUrl: text("avatar_url"),
    subscriptionTier: text("subscription_tier").notNull().default("free"),
    /** Set when the onboarding welcome email has been sent; prevents duplicates. */
    welcomeEmailSentAt: timestamp("welcome_email_sent_at", { withTimezone: true }),
    /** Opt-out flag for non-transactional mail (digest, reports). */
    marketingOptIn: boolean("marketing_opt_in").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("profiles_user_idx").on(t.userId)],
);

/**
 * Short-lived email verification codes for the custom signup flow.
 * A code is single-use and expires after 10 minutes.
 */
export const emailVerificationCode = pgTable(
  "email_verification_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("email_otp_lookup_idx").on(t.email, t.createdAt)],
);

export const userPreference = pgTable(
  "user_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    category: text("category").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("user_preferences_uniq").on(t.userId, t.category)],
);

export const savedProject = pgTable(
  "saved_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("saved_projects_uniq").on(t.userId, t.projectId),
    index("saved_projects_user_idx").on(t.userId, t.createdAt),
  ],
);

export const follows = pgTable(
  "follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("follows_uniq").on(t.userId, t.projectId),
    index("follows_user_idx").on(t.userId, t.createdAt),
  ],
);

export const subscription = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    plan: text("plan").notNull().default("free"),
    status: text("status").notNull().default("inactive"),
    renewalDate: timestamp("renewal_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("subscriptions_user_uniq").on(t.userId)],
);

export const userFeedback = pgTable(
  "user_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    kind: feedbackKindEnum("kind").notNull(),
    note: text("note"),
    status: feedbackStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("feedback_status_idx").on(t.status, t.createdAt)],
);

/* ===========================================================================
   Operations
   ======================================================================== */

export const jobRun = pgTable(
  "job_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    job: text("job").notNull(),
    status: jobStatusEnum("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    itemsIn: integer("items_in").notNull().default(0),
    itemsOut: integer("items_out").notNull().default(0),
    lastError: text("last_error"),
    meta: jsonb("meta"),
  },
  (t) => [index("job_run_job_idx").on(t.job, t.startedAt)],
);

/**
 * Double opt-in list for the Monday weekly digest.
 * `email` is lowercase text (PGlite has no citext). After unsubscribe it is
 * cleared within 30 days; `email_hash` stays so the address is not treated as new.
 */
export const newsletterSubscriber = pgTable(
  "newsletter_subscriber",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email"),
    emailHash: text("email_hash").notNull(),
    locale: text("locale").notNull().default("zh"),
    status: newsletterStatusEnum("status").notNull().default("pending"),
    confirmTokenHash: text("confirm_token_hash"),
    confirmExpiresAt: timestamp("confirm_expires_at", { withTimezone: true }),
    unsubTokenHash: text("unsub_token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    purgeEmailAt: timestamp("purge_email_at", { withTimezone: true }),
    source: text("source"),
    consentIpHash: text("consent_ip_hash"),
    consentUa: text("consent_ua"),
  },
  (t) => [
    unique("newsletter_subscriber_email_uniq").on(t.email),
    unique("newsletter_subscriber_email_hash_uniq").on(t.emailHash),
    unique("newsletter_subscriber_unsub_uniq").on(t.unsubTokenHash),
    index("newsletter_subscriber_confirm_idx").on(t.confirmTokenHash),
    index("newsletter_subscriber_status_idx").on(t.status),
  ],
);

/** One row per subscriber per edition. The unique pair is what makes the job idempotent. */
export const newsletterSend = pgTable(
  "newsletter_send",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionDate: date("edition_date").notNull(),
    subscriberId: uuid("subscriber_id")
      .notNull()
      .references(() => newsletterSubscriber.id, { onDelete: "cascade" }),
    resendMessageId: text("resend_message_id"),
    status: newsletterSendStatusEnum("status").notNull().default("queued"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("newsletter_send_edition_subscriber_uniq").on(t.editionDate, t.subscriberId),
    index("newsletter_send_message_idx").on(t.resendMessageId),
  ],
);

/** Coarse counters for subscribe abuse. Keys are hashes, never raw addresses or IPs. */
export const newsletterRateEvent = pgTable(
  "newsletter_rate_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bucket: text("bucket").notNull(),
    keyHash: text("key_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("newsletter_rate_event_idx").on(t.bucket, t.keyHash, t.createdAt)],
);

/**
 * Drives the public /status page. When a source has failed repeatedly the
 * homepage says so rather than pretending everything is fine.
 */
export const dataSourceHealth = pgTable("data_source_health", {
  source: text("source").primaryKey(),
  lastOkAt: timestamp("last_ok_at", { withTimezone: true }),
  lastError: text("last_error"),
  lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  /** GitHub quota remaining, HN reachability, etc. */
  quotaRemaining: integer("quota_remaining"),
  latencyMs: integer("latency_ms"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ===========================================================================
   Inferred types
   ======================================================================== */

export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;
export type Skill = typeof skill.$inferSelect;
export type NewSkill = typeof skill.$inferInsert;
export type DailySignal = typeof dailySignal.$inferSelect;
export type NewDailySignal = typeof dailySignal.$inferInsert;
export type AiContent = typeof aiContent.$inferSelect;
export type NewAiContent = typeof aiContent.$inferInsert;
export type RepoSnapshot = typeof repoSnapshot.$inferSelect;
export type NewRepoSnapshot = typeof repoSnapshot.$inferInsert;
export type JobRun = typeof jobRun.$inferSelect;
export type Category = (typeof categoryEnum.enumValues)[number];
export type Difficulty = (typeof difficultyEnum.enumValues)[number];
export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];
export type SkillType = (typeof skillTypeEnum.enumValues)[number];
export type SecurityLevel = (typeof securityLevelEnum.enumValues)[number];
export type Recommendation = (typeof recommendationEnum.enumValues)[number];
export type NewsletterSubscriber = typeof newsletterSubscriber.$inferSelect;
export type NewsletterStatus = (typeof newsletterStatusEnum.enumValues)[number];
