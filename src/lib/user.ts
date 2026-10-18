import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { follows, profile, project, savedProject, subscription, userPreference } from '@/db/schema';

export const INTEREST_OPTIONS = [
  'AI Agents',
  'MCP',
  'AI Skills',
  'Open Source',
  'React',
  'TypeScript',
  'Python',
  'Developer Tools',
  'APIs',
  'Frontend',
  'Backend',
  'AI Coding',
] as const;

export const FREE_SAVE_LIMIT = 20;
export const FREE_FOLLOW_LIMIT = 10;

export async function ensureProfile(user: { id: string; email?: string; user_metadata?: any }) {
  const d = await db();
  const display = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? null;
  const avatar = user.user_metadata?.avatar_url ?? null;
  await d
    .insert(profile)
    .values({ userId: user.id, username: display, avatarUrl: avatar })
    .onConflictDoNothing({ target: profile.userId });
  await d
    .insert(subscription)
    .values({ userId: user.id, plan: 'free', status: 'inactive' })
    .onConflictDoNothing({ target: subscription.userId });
  return getProfile(user.id);
}

export async function getProfile(userId: string) {
  const d = await db();
  const [p] = await d.select().from(profile).where(eq(profile.userId, userId)).limit(1);
  const [s] = await d.select().from(subscription).where(eq(subscription.userId, userId)).limit(1);
  const prefs = await d.select().from(userPreference).where(eq(userPreference.userId, userId));
  return {
    profile: p ?? null,
    subscription: s ?? null,
    interests: prefs.map((x) => x.category),
    isPro: p?.subscriptionTier === 'pro' || s?.plan === 'pro',
  };
}

export async function saveInterests(userId: string, categories: string[]) {
  const d = await db();
  const clean = categories.filter((c) => (INTEREST_OPTIONS as readonly string[]).includes(c));
  await d.delete(userPreference).where(eq(userPreference.userId, userId));
  if (clean.length) {
    await d.insert(userPreference).values(clean.map((category) => ({ userId, category }))).onConflictDoNothing();
  }
}

export async function markWelcomeEmailSent(userId: string) {
  const d = await db();
  await d.update(profile).set({ welcomeEmailSentAt: new Date() }).where(eq(profile.userId, userId));
}

export async function getSavedProjectsForUser(userId: string) {
  const d = await db();
  return d
    .select({
      id: savedProject.id,
      projectId: savedProject.projectId,
      createdAt: savedProject.createdAt,
    })
    .from(savedProject)
    .where(eq(savedProject.userId, userId));
}

/**
 * Saved projects joined with their display fields.
 *
 * The /saved page needs a slug to link with and a name to show. Previously the
 * page only read localStorage while the SAVE button only wrote to this table,
 * so a signed-in save never appeared anywhere.
 */
export async function getSavedProjectsWithMeta(userId: string) {
  const d = await db();
  return d
    .select({
      slug: project.slug,
      name: project.name,
      fullName: project.fullName,
      createdAt: savedProject.createdAt,
    })
    .from(savedProject)
    .innerJoin(project, eq(project.id, savedProject.projectId))
    .where(eq(savedProject.userId, userId))
    .orderBy(desc(savedProject.createdAt));
}

/** Followed projects joined with their display fields (same reason as above). */
export async function getFollowedProjectsWithMeta(userId: string) {
  const d = await db();
  return d
    .select({
      slug: project.slug,
      name: project.name,
      fullName: project.fullName,
      createdAt: follows.createdAt,
    })
    .from(follows)
    .innerJoin(project, eq(project.id, follows.projectId))
    .where(eq(follows.userId, userId))
    .orderBy(desc(follows.createdAt));
}

export async function getFollowedProjectsForUser(userId: string) {
  const d = await db();
  return d
    .select({
      id: follows.id,
      projectId: follows.projectId,
      createdAt: follows.createdAt,
    })
    .from(follows)
    .where(eq(follows.userId, userId));
}

export async function toggleSavedProject(userId: string, projectId: string) {
  const d = await db();
  const [existing] = await d
    .select({ id: savedProject.id })
    .from(savedProject)
    .where(and(eq(savedProject.userId, userId), eq(savedProject.projectId, projectId)))
    .limit(1);
  if (existing) {
    await d.delete(savedProject).where(eq(savedProject.id, existing.id));
    return { saved: false };
  }
  const me = await getProfile(userId);
  const [countRow] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(savedProject)
    .where(eq(savedProject.userId, userId));
  if (!me.isPro && (countRow?.n ?? 0) >= FREE_SAVE_LIMIT) {
    return { saved: false, limitReached: true };
  }
  await d.insert(savedProject).values({ userId, projectId }).onConflictDoNothing();
  return { saved: true };
}

export async function toggleFollowProject(userId: string, projectId: string) {
  const d = await db();
  const [existing] = await d
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.userId, userId), eq(follows.projectId, projectId)))
    .limit(1);
  if (existing) {
    await d.delete(follows).where(eq(follows.id, existing.id));
    return { following: false };
  }
  const me = await getProfile(userId);
  const [countRow] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.userId, userId));
  if (!me.isPro && (countRow?.n ?? 0) >= FREE_FOLLOW_LIMIT) {
    return { following: false, limitReached: true };
  }
  await d.insert(follows).values({ userId, projectId }).onConflictDoNothing();
  return { following: true };
}
