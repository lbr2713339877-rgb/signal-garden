"use client";

/**
 * Bilingual rendering, with no reload and no flash.
 *
 * V2 requires the switch to take effect instantly ("不刷新页面") and warns
 * against untranslated text leaking through. The mechanism:
 *
 *   - the server renders BOTH languages, each wrapped in a [data-lang] node
 *   - one attribute on <html> decides which is visible, via CSS
 *   - an inline script sets that attribute before first paint, so a returning
 *     visitor never sees the wrong language flash
 *
 * Switching therefore costs one attribute write. There is no refetch, no
 * re-render, no loading state, and nothing to fall out of sync — a page can
 * never end up half-translated, which is the failure mode this avoids.
 */

import { useEffect, useState } from "react";

export type Lang = "zh" | "en";

const KEY = "signal-garden:lang";
export const LANG_ATTR = "data-lang";

export function LangText({
  zh,
  en,
  as: Tag = "span",
  className,
}: {
  zh: React.ReactNode;
  en: React.ReactNode;
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <Tag className={className}>
      <span data-lang="zh">{zh}</span>
      <span data-lang="en">{en}</span>
    </Tag>
  );
}

/**
 * Current UI language, tracked live from <html data-lang>.
 *
 * Client components that need a *string* (input placeholders, aria-labels,
 * button text passed as a prop) cannot use the dual-render <T> component,
 * because those attributes hold one value. This hook lets them read the active
 * language and re-render when the switcher flips it.
 */
export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>("zh");

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setLang((root.getAttribute(LANG_ATTR) as Lang) ?? "zh");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: [LANG_ATTR] });
    return () => observer.disconnect();
  }, []);

  return lang;
}

/** The switcher. Reads the live attribute so it stays correct if anything else changes it. */
export function LangSwitch() {
  const [lang, setLang] = useState<Lang>("zh");

  useEffect(() => {
    const current = (document.documentElement.getAttribute(LANG_ATTR) as Lang) ?? "zh";
    setLang(current);
  }, []);

  function choose(next: Lang) {
    if (next === lang) return;
    setLang(next);
    const root = document.documentElement;
    root.setAttribute(LANG_ATTR, next);
    // 同步 lang 属性：无障碍、:lang() 选择器、浏览器翻译提示都依赖它
    root.setAttribute("lang", next === "en" ? "en" : "zh-CN");
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Private mode: the attribute still applies for this page view.
    }
  }

  return (
    <div
      role="group"
      aria-label="Language / 语言"
      className="relative flex items-center gap-0.5 rounded-full border border-[var(--hairline)] p-0.5"
    >
      {(["zh", "en"] as const).map((l) => {
        const on = lang === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => choose(l)}
            aria-pressed={on}
            className="rounded-full px-2.5 py-[3px] text-[length:var(--fs-tag)] tracking-[var(--ls-tag)] uppercase transition-colors duration-[var(--d-fast)]"
            style={{
              background: on ? "var(--glass-2)" : "transparent",
              color: on ? "var(--ink-1)" : "var(--ink-4)",
            }}
          >
            {l === "zh" ? "中" : "EN"}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Applies the stored language before paint. Inlined in <head> so the correct
 * language is set on the first frame.
 */
/**
 * Applies the stored language before paint. Inlined in <head> so the correct
 * language is set on the first frame.
 *
 * 优先级：localStorage → 浏览器语言 → zh。
 * 同时同步 <html lang>（既是无障碍要求，也让 :lang() 选择器、浏览器翻译
 * 提示、字体回退都能拿到正确值）。
 */
export const LANG_BOOTSTRAP = `(function(){try{
var L={zh:"zh-CN",en:"en"};
function set(l){document.documentElement.setAttribute("${LANG_ATTR}",l);document.documentElement.setAttribute("lang",L[l]||"zh-CN")}
var s=localStorage.getItem("${KEY}");
if(s==="en"||s==="zh"){set(s);return}
var n=(navigator.language||navigator.languages&&navigator.languages[0]||"zh").toLowerCase();
set(n.indexOf("zh")===0?"zh":"en")
}catch(e){document.documentElement.setAttribute("${LANG_ATTR}","zh")}})();`;

/**
 * Dark is the default; light is the alternative (V2 §7.8). Like the language
 * switch this is one attribute on <html> — tokens.css redefines every colour
 * variable under [data-theme="light"], so no component knows a theme exists.
 */
const THEME_KEY = "signal-garden:theme";

export function ThemeSwitch() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const t = (document.documentElement.getAttribute("data-theme") as "dark" | "light") ?? "dark";
    setTheme(t);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private mode: the attribute still applies for this page view.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "切换到浅色" : "Switch to dark"}
      title={theme === "dark" ? "浅色" : "深色"}
      className="text-[var(--ink-4)] transition-colors duration-[var(--d-fast)] hover:text-[var(--ink-1)]"
    >
      {theme === "dark" ? (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.3" />
          <path d="M7 1v1.6M7 11.4V13M1 7h1.6M11.4 7H13M2.8 2.8l1.1 1.1M10.1 10.1l1.1 1.1M11.2 2.8l-1.1 1.1M3.9 10.1l-1.1 1.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M12 8.5A5.2 5.2 0 0 1 5.5 2a5.5 5.5 0 1 0 6.5 6.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/** Applies the stored theme before paint, alongside the language bootstrap. */
export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");document.documentElement.setAttribute("data-theme",t==="light"?"light":"dark")}catch(e){}})();`;
