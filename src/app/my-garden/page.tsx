import Link from 'next/link';
import { redirect } from 'next/navigation';
import { V3Shell } from '@/components/v3/V3Shell';
import { getProjectsByIds } from '@/db/queries';
import { T } from '@/lib/dict';
import { getCurrentUser } from '@/lib/supabase/server';
import { ensureProfile, getFollowedProjectsForUser, getSavedProjectsForUser } from '@/lib/user';

export const revalidate = 0;

function ProjectList({
  rows,
  emptyKey,
}: {
  rows: Awaited<ReturnType<typeof getProjectsByIds>>;
  emptyKey: 'pg.garden.emptySaved' | 'pg.garden.emptyFollowing';
}) {
  if (!rows.length) {
    return <T k={emptyKey} as="p" className="body mt-6 text-[var(--ink-3)]" />;
  }

  return (
    <ul className="mt-6">
      {rows.map((project) => (
        <li key={project.id} className="border-t border-[var(--glass-1-border)] py-5">
          <Link href={`/p/${project.slug}`} className="block hover:opacity-80">
            <span className="body block text-[var(--ink-1)]">{project.name}</span>
            <span className="data mt-1 block text-[var(--ink-4)]">
              {project.owner ?? project.primaryCategory ?? project.category ?? '—'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function MyGardenPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  await ensureProfile(user);

  const [saved, following] = await Promise.all([
    getSavedProjectsForUser(user.id),
    getFollowedProjectsForUser(user.id),
  ]);
  const ids = [...new Set([...saved, ...following].map((row) => row.projectId))];
  const projects = await getProjectsByIds(ids);
  const byId = new Map(projects.map((project) => [project.id, project]));
  const savedProjects = saved.map((row) => byId.get(row.projectId)).filter((p) => !!p);
  const followedProjects = following.map((row) => byId.get(row.projectId)).filter((p) => !!p);

  return (
    <V3Shell>
      <div className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-[clamp(96px,14vh,180px)] pb-[var(--section-gap)]">
        <T k="pg.garden.kicker" as="p" className="system text-[var(--ink-4)]" fade={false} />
        <T k="pg.garden.title" as="h1" className="display-xl mt-6" />
        <div className="mt-8 flex gap-6 text-[var(--ink-3)]">
          <Link href="/saved" className="system hover:text-[var(--ink-1)]">
            <T k="pg.garden.localSaves" as="span" fade={false} />
          </Link>
        </div>

        <section className="mt-20 border-t border-[var(--glass-1-border)] pt-8">
          <T k="pg.garden.saved" as="p" className="system text-[var(--ink-2)]" fade={false} />
          <ProjectList rows={savedProjects} emptyKey="pg.garden.emptySaved" />
        </section>

        <section className="mt-20 border-t border-[var(--glass-1-border)] pt-8">
          <T k="pg.garden.following" as="p" className="system text-[var(--ink-2)]" fade={false} />
          <ProjectList rows={followedProjects} emptyKey="pg.garden.emptyFollowing" />
        </section>
      </div>
    </V3Shell>
  );
}
