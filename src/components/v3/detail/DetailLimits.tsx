/**
 * 详情页第六屏 —— Limits / Risk（可信度的一部分）
 *
 * 规格（§9 第六屏）：
 *   "不用警告弹窗、不用红色。风险表达方式：材质变冷（环境光饱和度降低 60%、
 *    亮度降低 40%），排版变克制（字号回到 System 层、字距加大），结构变规则
 *    （编号、缩进、等宽）。风险不是给用户看的警告，是产品的可信度证据。"
 *
 * 所以这里没有红色、没有图标、没有"警告"字样。整个区块降低彩度，回到
 * 等宽系统层，编号排列。缺失的能力（需要 API Key、需要本地环境、浏览器
 * 权限、早期阶段）如实列出，能确认的写"是"，文档里没写的写"未在文档中发现"。
 *
 * ── 一条不能越过的线 ───────────────────────────────────────────────────
 * 这一块只能说"文档里有没有写"，不能说"安不安全"。没有命中风险模式不等于
 * 安全，所以每个否定结论后面都跟着这个限定。
 */

import { T } from '@/lib/dict';
import { LANG } from '@/lib/i18n';

/** English labels for the static risk scanner's stable flag ids. */
const RISK_LABEL_EN: Record<string, string> = {
  remote_script: 'Runs a remote script',
  unknown_binary: 'Downloads an unknown binary',
  system_privilege: 'Needs system permissions',
  shell_exec: 'Runs shell commands',
  browser_control: 'Controls a browser',
  file_rw: 'Reads and writes local files',
  api_key_read: 'Reads an API key',
  install_script: 'Runs a script during install',
};
import type { Bi } from './DetailObservations';

export interface LimitItem {
  key: string;
  /** 系统层标题。中英一对 —— 详情页是服务端组件，渲染时不知道客户端语言。 */
  label: Bi;
  /** 结论 */
  value: Bi;
  /** 来源/限定 */
  note?: Bi;
}

export function DetailLimits({
  items,
  flags,
  securityLabel,
  securityLabelEn,
  riskNoteZh,
  riskNoteEn,
  hostedProduct = false,
}: {
  items: LimitItem[];
  flags: { id: string; label: string; severity: string; source: string; snippet: string }[] | null;
  securityLabel: string;
  securityLabelEn: string;
  riskNoteZh?: string | null;
  riskNoteEn?: string | null;
  hostedProduct?: boolean;
}) {
  return (
    <div
      className="glass-1 relative overflow-hidden p-6 md:p-8"
      /* 材质变冷：整块降低饱和度与亮度 */
      style={{ filter: 'saturate(0.4) brightness(0.92)' }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="system">
          <T k="pd.limits.header" as="span" fade={false} />
        </p>
        <p className="data text-[var(--ink-3)]"><LANG zh={securityLabel} en={securityLabelEn} /></p>
      </div>

      {/* 编号排列，等宽 —— 结构变规则 */}
      <dl className="mt-8 flex flex-col">
        {items.map((it, i) => (
          <div
            key={it.key}
            className="flex flex-col gap-1 border-t border-[var(--glass-1-border)] py-4 sm:flex-row sm:items-baseline sm:gap-6"
          >
            <dt className="system w-full shrink-0 sm:w-56">
              <span className="mr-3 text-[var(--ink-4)]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <LANG zh={it.label.zh} en={it.label.en} as="span" />
            </dt>
            <LANG
              zh={it.value.zh}
              en={it.value.en}
              as="dd"
              className="data min-w-0 flex-1 text-[var(--ink-1)]"
            />
            {it.note ? (
              <LANG
                zh={it.note.zh}
                en={it.note.en}
                as="dd"
                className="system shrink-0 text-[var(--ink-4)] sm:text-right"
              />
            ) : null}
          </div>
        ))}
      </dl>

      {/* 静态扫描结果 */}
      <div className="mt-8 border-t border-[var(--glass-1-border)] pt-6">
        <p className="system">
          {hostedProduct ? <LANG zh="核验范围" en="Review scope" /> : <T k="pd.limits.scan" as="span" fade={false} />}
        </p>

        {hostedProduct ? <LANG zh="核验了官方产品页面与使用入口，未审计服务端代码。" en="The official product page and usage links were checked. Server-side code has not been audited." as="p" className="body mt-3 text-[var(--ink-3)]" /> : flags === null ? (
          <T k="pd.limits.notScanned" as="p" className="body mt-3 text-[var(--ink-3)]" />
        ) : flags.length === 0 ? (
          <T k="pd.limits.clean" as="p" className="body mt-3 max-w-[62ch] text-[var(--ink-3)]" />
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {flags.map((f, i) => (
              <li key={`${f.id}-${i}`}>
                <p className="data text-[var(--ink-1)]">
                  <span className="mr-3 text-[var(--ink-4)]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <LANG zh={f.label} en={RISK_LABEL_EN[f.id] ?? f.label} />
                  <span className="ml-3 text-[var(--ink-4)]">{f.source}</span>
                </p>
                <pre className="data mt-2 overflow-x-auto border border-[var(--glass-1-border)] bg-[var(--bg-void)] p-3 whitespace-pre-wrap break-all text-[var(--ink-3)]">
                  {f.snippet}
                </pre>
              </li>
            ))}
          </ul>
        )}

        {riskNoteZh || riskNoteEn ? (
          <LANG
            zh={riskNoteZh ?? ""}
            en={riskNoteEn ?? ""}
            as="p"
            className="body mt-4 max-w-[62ch] text-[var(--ink-2)]"
          />
        ) : null}

      </div>
    </div>
  );
}
