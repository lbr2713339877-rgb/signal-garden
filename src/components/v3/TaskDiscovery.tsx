import Link from 'next/link';
import { T } from '@/lib/dict';

const TASKS = [
  { id: 'website', label: 'home.taskWebsite', body: 'home.taskWebsiteBody', href: '/c/indie-web' },
  { id: 'agent', label: 'home.taskAgent', body: 'home.taskAgentBody', href: '/c/skill-agent' },
  { id: 'video', label: 'home.taskVideo', body: 'home.taskVideoBody', href: '/search?q=%E8%A7%86%E9%A2%91' },
  { id: 'dashboard', label: 'home.taskDashboard', body: 'home.taskDashboardBody', href: '/search?q=%E5%90%8E%E5%8F%B0' },
] as const;

export function TaskDiscovery() {
  return (
    <section id="tasks" className="border-t border-[var(--glass-2-border)] px-[var(--gutter)] py-12 md:py-16">
      <div className="mx-auto max-w-[var(--container)]">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><T k="home.categories" as="p" className="system" fade={false} /><T k="home.byTask" as="h2" className="selection-title mt-3" /></div>
          <div className="flex flex-wrap gap-6"><Link href="/discoveries" className="body"><span data-lang="zh">有意思的</span><span data-lang="en">Interesting finds</span> ↗</Link><Link href="/c" className="body"><T k="home.allCategories" as="span" fade={false} /> →</Link></div>
        </div>
        <div className="mt-7 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
          {TASKS.map((task) => <Link key={task.id} href={task.href} data-discovery-target={task.id} data-discovery-placement="task" className="group border-t border-[var(--glass-2-border)] py-6">
            <div className="flex items-baseline justify-between gap-4"><T k={task.label} as="h3" className="discovery-title" fade={false} /><span aria-hidden className="transition-transform group-hover:translate-x-1">↗</span></div>
            <T k={task.body} as="p" className="body mt-3 text-[var(--ink-2)]" fade={false} />
          </Link>)}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-5 border-t border-[var(--glass-2-border)] pt-7">
          <div><T k="home.returnTitle" as="p" className="body" fade={false} /><T k="home.returnBody" as="p" className="data mt-2 text-[var(--ink-3)]" fade={false} /></div>
          <Link href="/saved" className="body inline-flex min-h-11 items-center gap-3 border-b border-[var(--glass-2-border)]"><T k="home.openSaved" as="span" fade={false} /> →</Link>
        </div>
      </div>
    </section>
  );
}
