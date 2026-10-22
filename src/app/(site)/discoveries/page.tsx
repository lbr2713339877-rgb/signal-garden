import Link from 'next/link';
import type { Metadata } from 'next';
import { V3Shell } from '@/components/v3/V3Shell';
import { ProjectDirectory, type DirectoryGroup } from '@/components/v3/category/ProjectDirectory';
import { getInterestingDiscoveries } from '@/db/queries';
import { LANG } from '@/lib/i18n';
import { TAXONOMY } from '@/normalizers/taxonomy';

export const revalidate = 0;
export const metadata: Metadata = { title: '有意思的 · Interesting finds', description: '值得亲自试一下的机器人、创作工具和互动作品。' };
export default async function DiscoveriesPage() {
  const cards = await getInterestingDiscoveries();
  const uses = [
    { key: 'bots', zh: '把 AI 带进聊天', en: 'AI in your conversations', subs: ['bots', 'chat-agent'] },
    { key: 'create', zh: '做点看得见、听得到的', en: 'Make something you can see or hear', subs: ['image-video', 'voice-music', 'writing'] },
    { key: 'play', zh: '点开玩一下', en: 'Something to play with', subs: ['interactive'] },
  ];
  const groups: DirectoryGroup[] = uses.map(u => ({ ...u, cards: cards.filter(c => u.subs.includes(c.secondaryCategory ?? '')) }));
  groups.push({ key: 'other', zh: '还有这些新发现', en: 'More discoveries', cards: cards.filter(c => !uses.some(u => u.subs.includes(c.secondaryCategory ?? ''))) });
  return <V3Shell><main className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-28 pb-[var(--section-gap)]">
    <p className="system">A LITTLE CURIOSITY</p>
    <h1 className="selection-title mt-4"><LANG zh="有意思的。" en="Worth a little curiosity." /></h1>
    <p className="body mt-5 max-w-[54ch] text-[var(--ink-2)]"><LANG zh="一个群聊助手，一段新做的视频，或一个想点开玩的作品。先看看它能做什么。" en="A bot for your group chat, a new way to make videos, or something to play with. Take a closer look." /></p>
    <nav className="mt-8 flex flex-wrap gap-x-7 gap-y-4" aria-label="分类 / Categories">
      {TAXONOMY.map(t => <Link key={t.key} href={`/c/${t.key}`} className="data text-[var(--ink-3)]"><LANG zh={t.label} en={t.en} /></Link>)}
    </nav>
    <div className="mt-10">{cards.length ? <ProjectDirectory groups={groups} accent="var(--light-amber)" /> : <p className="body text-[var(--ink-2)]"><LANG zh="新发现正在筛选。先逛逛其他分类，合适的项目会持续加入这里。" en="New discoveries are being reviewed. Explore the other categories in the meantime." /><Link href="/c" className="ml-3 underline"><LANG zh="浏览分类" en="Browse categories" /> →</Link></p>}</div>
  </main></V3Shell>;
}
