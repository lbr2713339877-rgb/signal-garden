'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { T } from '@/lib/dict';
import { LANG } from '@/lib/i18n';
import { installOptions } from '@/lib/install-options';

export interface InstallCommand { kind: string; command: string; source: string }
const LABELS: Record<string, string> = {
  'claude-mcp': 'Claude Code · MCP', 'mcp-config': 'MCP config',
  uv: 'UV · Python', pip: 'PIP · Python', pipx: 'PIPX · Python',
  npm: 'NPM · Node.js', pnpm: 'PNPM · Node.js', yarn: 'Yarn · Node.js',
  docker: 'Docker', brew: 'Homebrew', cargo: 'Cargo · Rust',
};

export function DetailInstall({ commands }: { commands: InstallCommand[] }) {
  const options = useMemo(() => installOptions(commands), [commands]);
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'manual'>('idle');
  const codeRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = options[selected] ?? options[0];
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const copy = async () => {
    try { await navigator.clipboard.writeText(current.command); setCopied('ok'); }
    catch {
      if (codeRef.current) {
        const range = document.createRange(); range.selectNodeContents(codeRef.current);
        const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
      }
      setCopied('manual');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied('idle'), 2000);
  };
  if (!current) return <div className="glass-1 p-6"><T k="pd.inst.empty" as="p" className="body text-[var(--ink-3)]" /></div>;
  return <div>
    <div className="mb-4 flex flex-wrap gap-3" role="group" aria-label="Installation options / 安装方式">
      {options.map((option, i) => <button key={i} type="button" aria-pressed={i === selected}
        className="data border px-4 py-2" style={{ borderColor: i === selected ? 'var(--light-mint)' : 'var(--glass-2-border)', color: i === selected ? 'var(--ink-1)' : 'var(--ink-3)' }}
        onClick={() => { setSelected(i); setCopied('idle'); if (timer.current) clearTimeout(timer.current); }}>
        {LABELS[option.kind.toLowerCase()] ?? option.kind.toUpperCase()}{options.filter((o) => o.kind === option.kind).length > 1 ? ` · ${options.slice(0, i + 1).filter((o) => o.kind === option.kind).length}` : ''}
      </button>)}
    </div>
    <div className="glass-1 overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--glass-2-border)] px-5 py-3">
        <span className="system">{LABELS[current.kind.toLowerCase()] ?? current.kind.toUpperCase()}</span>
        <button type="button" onClick={copy} className="data border border-[var(--glass-2-border)] px-4 py-2" aria-live="polite"><T k={copied === 'ok' ? 'act.copied' : copied === 'manual' ? 'act.copyManual' : 'act.copy'} as="span" fade={false} /></button>
      </div>
      <pre className="overflow-x-auto p-5 whitespace-pre-wrap break-words"><code ref={codeRef} className="data text-[var(--ink-1)]">{current.command.trim()}</code></pre>
    </div>
    <p className="body mt-4 text-[var(--ink-3)]"><LANG zh="选择与你的环境对应的方式。命令来自项目文档，未运行实测。" en="Choose the option for your environment. Commands come from project documentation and have not been run-tested." /></p>
  </div>;
}
