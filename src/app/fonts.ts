import localFont from "next/font/local";
import { Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";

/**
 * Self-hosted faces. next/font merges the @font-face rules into the app CSS
 * and serves the files from this origin, so there is no render-blocking
 * external font stylesheet.
 *
 * Weights are the ones the UI actually sets:
 *   Inter Tight      300 (wordmark), 400 (body), 500 (system/titles), 600 (wordmark utility)
 *   Instrument Serif 400 (display). Italic is unused and not loaded.
 *   IBM Plex Mono    400 (data). The file is a single static weight.
 *   JetBrains Mono   400 (mono fallback)
 *   Noto Sans SC     400 and 500 (body and medium sans, including CJK)
 *   Noto Serif SC    400 (display/editorial). Weight 600 is not used on the serif stack.
 *
 * LXGW WenKai Mono is unused and is not loaded.
 * Only Instrument Serif is preloaded — it is the homepage LCP face.
 * unicode-range is per file. next/font/local applies `declarations` to every
 * face in one call, so latin and latin-ext are separate families.
 */

/** LCP face. Preloaded, size-adjusted serif fallback, font-display: swap. */
export const instrumentSerif = localFont({
  src: "../../public/fonts/instrument-serif-latin.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  preload: true,
  variable: "--font-instrument-serif",
  adjustFontFallback: "Times New Roman",
});

export const interTight = localFont({
  src: "../../public/fonts/inter-tight-latin.woff2",
  weight: "300 600",
  style: "normal",
  display: "swap",
  preload: false,
  variable: "--font-inter-tight",
  adjustFontFallback: "Arial",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
});

export const interTightExt = localFont({
  src: "../../public/fonts/inter-tight-latin-ext.woff2",
  weight: "300 600",
  style: "normal",
  display: "swap",
  preload: false,
  variable: "--font-inter-tight-ext",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" }],
});

export const ibmPlexMono = localFont({
  src: "../../public/fonts/ibm-plex-mono-latin.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  preload: false,
  variable: "--font-ibm-plex-mono",
  adjustFontFallback: false,
});

export const jetbrainsMono = localFont({
  src: "../../public/fonts/jetbrains-mono-latin.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  preload: false,
  variable: "--font-jetbrains-mono",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
});

export const jetbrainsMonoExt = localFont({
  src: "../../public/fonts/jetbrains-mono-latin-ext.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  preload: false,
  variable: "--font-jetbrains-mono-ext",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" }],
});

/**
 * preload is false on purpose. The `subsets` value only selects which files
 * to preload; with preloading off, next/font still self-hosts every
 * unicode-range slice Google returns, including Chinese.
 */
export const notoSansSC = Noto_Sans_SC({
  weight: ["400", "500"],
  display: "swap",
  preload: false,
  variable: "--font-noto-sans-sc",
  adjustFontFallback: false,
  subsets: ["latin"],
});

export const notoSerifSC = Noto_Serif_SC({
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-noto-serif-sc",
  adjustFontFallback: false,
  subsets: ["latin"],
});

export const fontVariableClassName = [
  instrumentSerif.variable,
  interTight.variable,
  interTightExt.variable,
  ibmPlexMono.variable,
  jetbrainsMono.variable,
  jetbrainsMonoExt.variable,
  notoSansSC.variable,
  notoSerifSC.variable,
].join(" ");
