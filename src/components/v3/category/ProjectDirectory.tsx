'use client';

import Link from 'next/link';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ProjectCard } from '@/db/queries';
import { Fallback, LANG } from '@/lib/i18n';
import { DISCOVERY_MEDIA } from '@/lib/discovery-media';
import { SITE_PREVIEWS } from '@/lib/site-previews';
import { categoryLabelEn } from '../category-color';

export interface DirectoryGroup { key: string; zh: string; en: string; cards: ProjectCard[]; total?: number; href?: string }
const EASE = [0.23, 1, 0.32, 1] as const;

function PreviewImage({ card, large = false }: { card: ProjectCard; large?: boolean }) {
  const curated = SITE_PREVIEWS[card.slug];
  const author = DISCOVERY_MEDIA[card.slug];
  const src = curated?.src ?? author?.src ?? card.previewImageUrl;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <div className={`directory-image${large ? ' directory-image-large' : ''}`}>
    {src && !failed ? <img src={src} alt={`${card.name} preview`} loading={large ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} /> :
      <div className="directory-cover"><span className="system">{categoryLabelEn(card.primaryCategory)}</span><span className="directory-cover-name">{card.name}</span><span className="data"><LANG zh="查看用途与使用方式" en="Explore what it does" /></span></div>}
    <span className="directory-image-caption data"><LANG zh={curated ? '官网界面' : src && !failed ? '作者提供的项目图片' : '项目概览'} en={curated ? 'WEBSITE PREVIEW' : src && !failed ? 'IMAGE FROM THE PROJECT' : 'PROJECT OVERVIEW'} /></span>
  </div>;
}

function ExpandedPreview({ card, onClose, layoutId }: { card: ProjectCard; onClose: () => void; layoutId?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current; dialog?.showModal();
    const oldOverflow = document.body.style.overflow;
    const oldRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden';
    return () => { document.body.style.overflow = oldOverflow; document.documentElement.style.overflow = oldRootOverflow; dialog?.close(); returnFocus.current?.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} className="directory-dialog" data-lenis-prevent onCancel={e => { e.preventDefault(); onClose(); }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby={`preview-title-${card.slug}`}>
    <motion.article layoutId={layoutId} layoutRoot style={{ borderRadius: 14 }} transition={{ duration: .45, ease: EASE }} className="directory-dialog-card">
      <button autoFocus onClick={onClose} className="directory-close" aria-label="关闭预览 / Close preview">×</button>
      <PreviewImage card={card} large />
      <div className="directory-dialog-copy">
        <p className="system">{categoryLabelEn(card.primaryCategory)}{card.isInteresting ? ' / DISCOVERY' : ''}</p>
        <h2 id={`preview-title-${card.slug}`} className="selection-title mt-3">{card.name}</h2>
        <Fallback zh={card.oneLiner} en={card.oneLinerEn} className="body mt-4 block text-[var(--ink-2)]" />
        {!!card.capabilities?.length && <ul className="directory-capabilities">
          {card.capabilities.slice(0, 3).map((zh, i) => <li key={zh}><LANG zh={zh} en={card.capabilitiesEn?.[i] ?? ''} /></li>)}
        </ul>}
        <div className="directory-dialog-links">
          <Link href={`/p/${card.slug}`} className="body"><LANG zh="查看项目详情" en="Read the details" /> →</Link>
          <a href={card.homepageUrl || card.primaryUrl} target="_blank" rel="noopener noreferrer" className="body"><LANG zh="打开官网 / 项目" en="Visit the project" /> ↗</a>
        </div>
      </div>
    </motion.article>
  </dialog>;
}

export function ProjectDirectory({ groups, accent }: { groups: DirectoryGroup[]; accent: string }) {
  const reduced = useReducedMotion();
  const [desktopPreview, setDesktopPreview] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktopPreview(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const id = useId();
  const [active, setActive] = useState<ProjectCard | null>(null);
  const [preview, setPreview] = useState<ProjectCard | null>(groups[0]?.cards[0] ?? groups.find(g => g.cards.length)?.cards[0] ?? null);
  const [open, setOpen] = useState<ProjectCard | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  const show = (card: ProjectCard) => { clearClose(); if (!open) { setActive(card); setPreview(card); } };
  const leave = () => { clearClose(); closeTimer.current = setTimeout(() => { if (!open) setActive(null); }, 260); };
  useEffect(() => () => clearClose(), []);
  useEffect(() => { const hide = () => { clearClose(); setActive(null); }; window.addEventListener('scroll', hide, { passive: true }); return () => window.removeEventListener('scroll', hide); }, []);
  const chosen = preview;
  const layoutId = (card: ProjectCard) => reduced || !desktopPreview ? undefined : `${id}-preview-${card.id}`;
  return <LayoutGroup id={id}>
    <div className="directory-layout" style={{ '--directory-accent': accent } as React.CSSProperties}>
      <div className="directory-groups">
        {groups.filter(g => g.cards.length).map(group => <section key={group.key} className="directory-group" aria-labelledby={`${id}-${group.key}`}>
          <div className="directory-group-heading"><h2 id={`${id}-${group.key}`} className="system"><LANG zh={group.zh} en={group.en} /></h2><span className="data">{group.total ?? group.cards.length}</span></div>
          <div className="directory-rows" onPointerLeave={leave} data-engaged={!!active}>
            {(expanded[group.key] ? group.cards : group.cards.slice(0, 5)).map(card => <div key={card.id} className="directory-row" data-active={active?.id === card.id}
              onPointerEnter={e => { if (e.pointerType === 'mouse') show(card); }} onFocusCapture={() => show(card)}
              onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) leave(); }}>
              {active?.id === card.id && <motion.span aria-hidden className="directory-highlight" layoutId={`${id}-highlight`}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 430, damping: 35 }} style={{ borderRadius: 8 }} />}
              <Link href={`/p/${card.slug}`} className="directory-row-link">
                <span className="directory-row-title"><span>{card.name}</span>{card.isInteresting && <span className="directory-new data"><LANG zh="有意思" en="DISCOVERY" /></span>}</span>
                <Fallback zh={card.oneLiner} en={card.oneLinerEn} className="directory-row-description" />
              </Link>
              <button className="directory-peek" onClick={() => { clearClose(); setActive(card); setPreview(card); setOpen(card); }} aria-label={`预览 ${card.name} / Preview ${card.name}`} title="预览 / Preview">↗</button>
            </div>)}
          </div>
          {group.cards.length > 5 && <button className="directory-more data" onClick={() => setExpanded(x => ({ ...x, [group.key]: !x[group.key] }))}>
            <LANG zh={expanded[group.key] ? '收起' : `再看 ${group.cards.length - 5} 个`} en={expanded[group.key] ? 'Show less' : `Show ${group.cards.length - 5} more`} /> {expanded[group.key] ? '−' : '+'}
          </button>}
          {group.href && (group.total ?? 0) > group.cards.length && <Link href={group.href} className="directory-more data"><LANG zh="浏览这一用途的全部项目" en="Browse all in this group" /> →</Link>}
        </section>)}
      </div>
      <aside className="directory-preview" onPointerEnter={clearClose} onPointerLeave={leave} aria-label="项目预览 / Project preview">
        <p className="system mb-4"><LANG zh="移到项目上，先看一眼" en="A closer look, before you click" /></p>
        <AnimatePresence mode="wait" initial={false}>
          {chosen && <motion.div key={chosen.id} initial={reduced ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: .09 } }} transition={{ duration: .18, ease: EASE }}>
            <motion.button className="directory-preview-card" layoutId={layoutId(chosen)} style={{ borderRadius: 14 }} transition={{ duration: .45, ease: EASE }}
              onClick={() => setOpen(chosen)} aria-label={`展开 ${chosen.name} 预览 / Expand ${chosen.name}`}>
              <PreviewImage card={chosen} />
              <div className="directory-preview-copy"><span className="editorial">{chosen.name}</span><Fallback zh={chosen.oneLiner} en={chosen.oneLinerEn} className="body mt-3 block text-[var(--ink-2)]" /><span className="data mt-5 block"><LANG zh="展开看看" en="Expand preview" /> ↗</span></div>
            </motion.button>
          </motion.div>}
        </AnimatePresence>
      </aside>
    </div>
    <AnimatePresence>{open && <ExpandedPreview key={open.id} card={open} layoutId={layoutId(open)} onClose={() => setOpen(null)} />}</AnimatePresence>
  </LayoutGroup>;
}
