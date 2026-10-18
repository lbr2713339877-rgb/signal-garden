'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { T, t, type DictKey } from '@/lib/dict';
import { LangSwitch, useLang } from '@/components/ui/Lang';

type Tab = 'signin' | 'signup';
type Step = 'email' | 'code';

/**
 * Maps the stable error codes returned by /api/auth/* onto dictionary keys.
 *
 * The API used to return Chinese prose, so an English visitor always saw a
 * Chinese error. It now returns a code; unknown codes fall back to the raw
 * server message.
 */
const ERROR_KEYS: Record<string, DictKey> = {
  INVALID_EMAIL: 'lg.errInvalidEmail',
  COOLDOWN: 'lg.errCooldown',
  SEND_FAILED: 'lg.errSend',
  CODE_FORMAT: 'lg.errCodeFormat',
  CODE_INVALID: 'lg.errCodeInvalid',
  PASSWORD_LENGTH: 'lg.errPasswordLen',
  PASSWORD_MISMATCH: 'lg.errPasswordMatch',
  NOT_CONFIGURED: 'lg.errConfig',
  EMAIL_TAKEN: 'lg.errEmailTaken',
};

function errorKeyFor(code: unknown): DictKey | null {
  return typeof code === 'string' && code in ERROR_KEYS ? ERROR_KEYS[code] : null;
}

function Field({
  labelKey,
  type = 'text',
  value,
  onChange,
  autoComplete,
  maxLength,
  children,
}: {
  labelKey: DictKey;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  maxLength?: number;
  children?: React.ReactNode;
}) {
  /* A placeholder is a single-string attribute, so it cannot be dual-rendered
     like the label; it reads the live language instead. */
  const lang = useLang();
  return (
    <label className="block">
      <div className="flex items-end justify-between">
        <span className="system text-[var(--ink-4)]">
          <T k={labelKey} as="span" fade={false} />
        </span>
        {children}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        maxLength={maxLength}
        placeholder={t(lang, labelKey)}
        className="body mt-2 w-full rounded-[var(--r-md)] border border-[var(--glass-1-border)] bg-[var(--glass-1-fill)] px-4 py-3.5 text-[var(--ink-1)] outline-none transition-colors placeholder:text-[var(--ink-4)] focus:border-[var(--ink-3)]"
      />
    </label>
  );
}

/** Inline Google "G" SVG, kept as a literal so there is no external fetch. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M17.64 9.2c0-.64-.06-1.26-.16-1.86H9v3.52h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.64Z" fill="#4285F4"/>
      <path d="M9 18c2.44 0 4.48-.8 5.98-2.18l-2.92-2.26c-.8.54-1.84.86-3.06.86-2.36 0-4.36-1.6-5.08-3.74H.88v2.34A9 9 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.92 10.68a5.46 5.46 0 0 1 0-3.36V4.98H.88a9 9 0 0 0 0 8.04l3.04-2.34Z" fill="#FBBC05"/>
      <path d="M9 3.54c1.32 0 2.52.46 3.46 1.36l2.6-2.6A8.98 8.98 0 0 0 9 0 9 9 0 0 0 .88 4.98L3.92 7.3C4.64 5.14 6.64 3.54 9 3.54Z" fill="#EA4335"/>
    </svg>
  );
}

export function LoginPanel({ configured }: { configured: boolean }) {
  const lang = useLang();
  const [tab, setTab] = useState<Tab>('signin');
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  /* Feedback is stored as a dictionary key (or raw server text) so it
     re-localizes when the language is switched after it appears. */
  const [msgKey, setMsgKey] = useState<DictKey | null>(null);
  const [errKey, setErrKey] = useState<DictKey | null>(null);
  const [errText, setErrText] = useState('');

  function reset() {
    setStep('email');
    setCode('');
    setPassword('');
    setConfirm('');
    setMsgKey(null);
    setErrKey(null);
    setErrText('');
  }

  function clearNotes() {
    setMsgKey(null);
    setErrKey(null);
    setErrText('');
  }

  function failWith(code: unknown, fallback: unknown, fallbackKey: DictKey) {
    const key = errorKeyFor(code);
    if (key) {
      setErrKey(key);
      setErrText('');
    } else {
      setErrKey(null);
      setErrText(typeof fallback === 'string' && fallback ? fallback : t(lang, fallbackKey));
    }
  }

  function switchTab(next: Tab) {
    setTab(next);
    reset();
  }

  async function sendCode() {
    setBusy(true);
    clearNotes();
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        failWith(data.code, data.error, 'lg.errSend');
        return;
      }
      setStep('code');
      setMsgKey('lg.msgCodeSent');
    } catch (e) {
      setErrText(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function completeSignup() {
    setBusy(true);
    clearNotes();
    try {
      const res = await fetch('/api/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, password, confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        failWith(data.code, data.error, 'lg.errSignup');
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = '/onboarding';
    } catch (e) {
      setErrText(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    setBusy(true);
    clearNotes();
    try {
      if (!configured) {
        setErrKey('lg.errConfig');
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = '/my-garden';
    } catch (e) {
      setErrText(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setErrKey(null);
    setErrText('');
    if (!configured) {
      setErrKey('lg.errConfig');
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setErrText(error.message);
  }

  async function forgot() {
    if (!configured) {
      setErrKey('lg.errConfig');
      return;
    }
    setBusy(true);
    clearNotes();
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/login`,
    });
    setBusy(false);
    if (error) setErrText(error.message);
    else setMsgKey('lg.msgResetSent');
  }

  const passwordInvalid = password.length > 0 && (password.length < 8 || password.length > 20);
  const confirmInvalid = confirm.length > 0 && confirm !== password;

  /* ── Shared sub-components ────────────────────────────────────────────── */

  /** Full-width Google OAuth button. Always shown on signin and signup/email;
   *  hidden during code verification (user is mid-flow). */
  function GoogleButton() {
    return (
      <button
        type="button"
        onClick={google}
        className="flex w-full items-center justify-center gap-3 rounded-[var(--r-md)] border border-[var(--glass-2-border)] bg-[var(--glass-2-fill)] px-5 py-3 h-[48px] transition-colors hover:border-[var(--ink-1)]"
      >
        <GoogleIcon />
        <T k="lg.google" as="span" className="system text-[var(--ink-1)]" fade={false} />
      </button>
    );
  }

  /** 「或」分隔线 —— used between Google and the email form. */
  function OrDivider() {
    return (
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-[var(--glass-1-border)]" />
        <T k="lg.or" as="span" className="system text-[var(--ink-4)]" fade={false} />
        <span aria-hidden className="h-px flex-1 bg-[var(--glass-1-border)]" />
      </div>
    );
  }

  /** The submit button: solid, full-width, high-contrast. Label adapts to state. */
  function SubmitButton(args: {
    labelKey: DictKey;
    disabled?: boolean;
    type?: 'submit' | 'button';
  }) {
    return (
      <button
        type={args.type ?? 'submit'}
        disabled={busy || !!args.disabled}
        className="w-full rounded-[var(--r-md)] bg-[var(--ink-1)] px-5 py-3.5 system text-[var(--bg-void)] transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <T k={busy ? 'lg.busy' : args.labelKey} as="span" fade={false} />
      </button>
    );
  }

  /** "已经有账号？" / "还没有账号？" footer link. */
  function ModeSwitch() {
    return (
      <p className="body text-center text-[var(--ink-4)]">
        <T k={tab === 'signin' ? 'lg.noAccount' : 'lg.hasAccount'} as="span" fade={false} />{' '}
        <button
          type="button"
          onClick={() => switchTab(tab === 'signin' ? 'signup' : 'signin')}
          className="cursor-pointer text-[var(--ink-1)] underline underline-offset-4 transition-colors hover:text-[var(--ink-2)]"
        >
          <T k={tab === 'signin' ? 'lg.signUp' : 'lg.signIn'} as="span" fade={false} />
        </button>
      </p>
    );
  }

  function Legal() {
    return (
      <p className="system mx-auto max-w-[42ch] text-center text-[var(--ink-4)]">
        <T k="lg.agreePrefix" as="span" fade={false} />{' '}
        <Link href="/terms" className="underline underline-offset-4 transition-colors hover:text-[var(--ink-2)]">
          <T k="lg.terms" as="span" fade={false} />
        </Link>{' '}
        <T k="lg.and" as="span" fade={false} />{' '}
        <Link href="/privacy" className="underline underline-offset-4 transition-colors hover:text-[var(--ink-2)]">
          <T k="lg.privacy" as="span" fade={false} />
        </Link>
      </p>
    );
  }

  return (
    <section className="mx-auto grid min-h-[72dvh] w-full max-w-[1080px] items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <div className="flex items-center justify-between">
          <Link href="/" className="system text-[var(--ink-4)] hover:text-[var(--ink-1)]">SIGNAL GARDEN</Link>
          <LangSwitch />
        </div>
        <h1 className="display-xl mt-10 max-w-[11ch]">Discover what developers are building next.</h1>
        <T k="lg.hero" as="p" className="body mt-8 max-w-[40ch] text-[var(--ink-2)]" />
      </div>

      {/* ── Right card ──────────────────────────────────────────────────── */}

      <div className="glass-1 p-7 md:p-9 flex flex-col gap-5">

        {/* Google button (hidden on signup step=code) */}
        {(tab === 'signin' || step === 'email') ? (
          <>
            <GoogleButton />
            <OrDivider />
          </>
        ) : null}

        {/* ── Sign-in form ──────────────────────────────────────────────── */}
        {tab === 'signin' ? (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => { e.preventDefault(); signIn(); }}
          >
            <Field labelKey="lg.email" type="email" value={email} onChange={setEmail} autoComplete="email" />
            <Field labelKey="lg.password" type="password" value={password} onChange={setPassword} autoComplete="current-password">
              <button type="button" onClick={forgot} className="system whitespace-nowrap text-[var(--ink-4)] transition-colors hover:text-[var(--ink-1)]">
                <T k="lg.forgot" as="span" fade={false} />
              </button>
            </Field>
            <SubmitButton labelKey="lg.signIn" />
            {msgKey ? <p className="body text-[var(--light-mint)]">{t(lang, msgKey)}</p> : null}
            {errKey ? <p className="body break-words text-[var(--light-coral)]">{t(lang, errKey)}</p> : null}
            {errText ? <p className="body break-words text-[var(--light-coral)]">{errText}</p> : null}
            <ModeSwitch />
            <Legal />
          </form>
        ) : step === 'email' ? (
          /* ── Sign-up step 1: email ────────────────────────────────────── */
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => { e.preventDefault(); sendCode(); }}
          >
            <div>
              <p className="system text-[var(--ink-1)]"><T k="lg.createTitle" as="span" fade={false} /></p>
              <p className="body mt-2 text-[var(--ink-3)]"><T k="lg.createSub" as="span" fade={false} /></p>
            </div>
            <Field labelKey="lg.email" type="email" value={email} onChange={setEmail} autoComplete="email" />
            <SubmitButton labelKey="lg.sendCode" disabled={!email} />
            {msgKey ? <p className="body text-[var(--light-mint)]">{t(lang, msgKey)}</p> : null}
            {errKey ? <p className="body break-words text-[var(--light-coral)]">{t(lang, errKey)}</p> : null}
            {errText ? <p className="body break-words text-[var(--light-coral)]">{errText}</p> : null}
            <ModeSwitch />
            <Legal />
          </form>
        ) : (
          /* ── Sign-up step 2: verification + password ──────────────────── */
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => { e.preventDefault(); completeSignup(); }}
          >
            <div>
              <p className="system text-[var(--ink-1)]"><T k="lg.codeTitle" as="span" fade={false} /></p>
              <p className="data mt-2 text-[var(--ink-4)]">{email}</p>
            </div>
            <Field labelKey="lg.code" value={code} onChange={(v) => setCode(v.replace(/\D/g, ''))} maxLength={6} />
            <Field labelKey="lg.passwordNew" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
            {passwordInvalid ? (
              <p className="system text-[var(--light-coral)]"><T k="lg.errPasswordLen" as="span" fade={false} /></p>
            ) : null}
            <Field labelKey="lg.passwordConfirm" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            {confirmInvalid ? (
              <p className="system text-[var(--light-coral)]"><T k="lg.errPasswordMatch" as="span" fade={false} /></p>
            ) : null}
            <SubmitButton
              labelKey="lg.signUp"
              disabled={code.length !== 6 || passwordInvalid || confirmInvalid || !password || !confirm}
            />
            {msgKey ? <p className="body text-[var(--light-mint)]">{t(lang, msgKey)}</p> : null}
            {errKey ? <p className="body break-words text-[var(--light-coral)]">{t(lang, errKey)}</p> : null}
            {errText ? <p className="body break-words text-[var(--light-coral)]">{errText}</p> : null}
            <button type="button" onClick={() => setStep('email')} className="system text-left text-[var(--ink-4)] transition-colors hover:text-[var(--ink-1)]">
              <T k="lg.changeEmail" as="span" fade={false} />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
