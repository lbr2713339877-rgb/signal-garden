/**
 * 系统状态（V3）—— /status
 *
 * 这一页公开是刻意的：一个声称帮你从噪音里挑信号的产品，应该对数据中断诚实。
 *
 * 视觉上这里是全站最"冷"的一页 —— 环境光饱和度最低、排版最克制、结构最
 * 规则。这是 §9 "风险表达方式：材质变冷、排版变克制、结构变规则" 的同一条
 * 原则，用在整个状态页上。
 *
 * 状态点不用红色：失败用 coral（--light-coral），因为红色在这个产品里是
 * 一个不该出现的信号。
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { V3Shell } from '@/components/v3/V3Shell';
import { getSourceHealth } from '@/db/queries';
import { T, t, type DictKey } from '@/lib/dict';

export const metadata: Metadata = { title: '系统状态 · Status' };
export const revalidate = 0;

/** 任务说明的字典键 —— 之前是硬编码中文，英文模式会漏出中文 */
const JOB_NOTE_KEY: Record<string, DictKey> = {
  discover: 'pg.status.job.discover',
  enrich: 'pg.status.job.enrich',
  refocus: 'pg.status.job.refocus',
  score: 'pg.status.job.score',
  publish: 'pg.status.job.publish',
};

/** 统一的时间格式，不依赖 locale。 */
function stamp(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

export default async function StatusPage() {
  const { sources, runs, latestFailed } = await getSourceHealth(12);

  return (
    <V3Shell>
      <div
        className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-[clamp(96px,14vh,180px)] pb-[var(--section-gap)]"
        /* 整页降温：饱和度与亮度都往下压 */
        style={{ filter: 'saturate(0.55) brightness(0.96)' }}
      >
        <T k="pg.status.kicker" as="p" className="system" fade={false} />
        <T k="pg.status.title" as="h1" className="display-xl mt-6 max-w-[10ch]" />
        <T k="pg.status.sub" as="p" className="editorial mt-8 max-w-[36ch] text-[var(--ink-2)]" />

        {latestFailed ? (
          <section
            className="glass-1 mt-14 max-w-[72ch] p-6"
            style={{ borderLeft: '2px solid var(--light-coral)', filter: 'saturate(0.65)' }}
          >
            <T k="pg.status.lastFailure" as="p" className="system" fade={false} />
            <dl className="mt-5 grid gap-4 sm:grid-cols-[120px_1fr]">
              <dt className="system text-[var(--ink-4)]">
                <T k="pg.status.failureJob" as="span" fade={false} />
              </dt>
              <dd className="data text-[var(--ink-1)]">{latestFailed.job}</dd>
              <dt className="system text-[var(--ink-4)]">
                <T k="pg.status.failureTime" as="span" fade={false} />
              </dt>
              <dd className="data text-[var(--ink-2)]">{stamp(latestFailed.startedAt)}</dd>
              <dt className="system text-[var(--ink-4)]">
                <T k="pg.status.failureError" as="span" fade={false} />
              </dt>
              <dd className="data break-all text-[var(--light-coral)]">{latestFailed.lastError ?? '—'}</dd>
              <dt className="system text-[var(--ink-4)]">
                <T k="pg.status.failureImpact" as="span" fade={false} />
              </dt>
              <dd className="body text-[var(--ink-2)]">
                <T k={`pg.status.impact.${latestFailed.job}` as DictKey} as="span" fade={false} />
              </dd>
            </dl>
          </section>
        ) : null}

        {/* 数据源 */}
        <section className="mt-20 border-t border-[var(--glass-1-border)] pt-8">
          <T k="pg.status.sources" as="p" className="system" fade={false} />

          {sources.length ? (
            <ul className="mt-6 flex flex-col">
              {sources.map((s, i) => {
                const bad = s.consecutiveFailures > 0;
                return (
                  <li
                    key={s.source}
                    className="v3-row flex flex-wrap items-baseline gap-x-8 gap-y-2 border-t border-[var(--glass-1-border)] py-5"
                    style={{ '--i': i } as React.CSSProperties}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-[6px] w-[6px] shrink-0 rounded-full"
                      style={{
                        background: bad ? 'var(--light-coral)' : 'var(--light-mint)',
                      }}
                    />
                    <span className="data min-w-[140px] text-[var(--ink-1)]">{s.source}</span>
                    <span className="data text-[var(--ink-4)]">
                      <T k="pg.status.failures" as="span" fade={false} vars={{ n: s.consecutiveFailures }} />
                    </span>
                    {s.quotaRemaining !== null ? (
                      <T k="pg.status.quota" as="span" className="data text-[var(--ink-4)]" fade={false} vars={{ n: s.quotaRemaining }} />
                    ) : null}
                    {s.latencyMs ? (
                      <span className="data text-[var(--ink-4)]">{s.latencyMs}ms</span>
                    ) : null}
                    <span className="data ml-auto text-[var(--ink-4)]">
                      {s.lastOkAt ? t('zh', 'pg.status.lastOk', { d: stamp(s.lastOkAt) }) : t('zh', 'pg.status.neverOk')}
                    </span>

                    {s.lastError ? (
                      <p className="data w-full break-all text-[var(--light-coral)]">
                        {s.lastError}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <T k="pg.status.noSources" as="p" className="body mt-6 text-[var(--ink-3)]" />
          )}
        </section>

        {/* 任务运行记录 */}
        <section className="mt-20 border-t border-[var(--glass-1-border)] pt-8">
          <T k="pg.status.jobs" as="p" className="system" fade={false} />

          <div className="mt-6 flex flex-col">
            {runs.length ? (
              runs.map((r, i) => (
                <div
                  key={r.id}
                  className="v3-row flex flex-wrap items-baseline gap-x-8 gap-y-2 border-t border-[var(--glass-1-border)] py-4"
                  style={{ '--i': i } as React.CSSProperties}
                >
                  <span className="data min-w-[120px] text-[var(--ink-1)]">{r.job}</span>
                  <span
                    className="data min-w-[70px]"
                    style={{
                      color:
                        r.status === 'ok'
                          ? 'var(--light-mint)'
                          : r.status === 'failed'
                            ? 'var(--light-coral)'
                            : 'var(--ink-3)',
                    }}
                  >
                    {r.status}
                  </span>
                  <span className="data text-[var(--ink-4)]">
                    {r.itemsIn} / {r.itemsOut}
                  </span>
                  <span className="data text-[var(--ink-4)]">{JOB_NOTE_KEY[r.job] ? t('zh', JOB_NOTE_KEY[r.job]) : ''}</span>
                  <span className="data ml-auto text-[var(--ink-4)]">{stamp(r.startedAt)}</span>

                  {r.lastError ? (
                    <p className="data w-full max-w-[80ch] break-all text-[var(--ink-4)]">
                      {r.lastError.slice(0, 160)}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="body border-t border-[var(--glass-1-border)] py-5 text-[var(--ink-3)]">
                <T k="pg.status.noJobs" as="span" fade={false} />
              </p>
            )}
          </div>
        </section>

        <div className="mt-20 border-t border-[var(--glass-1-border)] pt-8">
          <Link
            href="/"
            className="system text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
          >
            <span aria-hidden>←</span> <T k="pd.back" as="span" fade={false} />
          </Link>
        </div>
      </div>
    </V3Shell>
  );
}
