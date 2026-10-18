export interface CopyRow {
  locale?: string | null;
  oneLiner?: string | null;
  hook?: string | null;
  targetUsers?: string[] | null;
  whyNow?: string[] | null;
  notFor?: string[] | null;
  capabilities?: string[] | null;
  installHint?: string | null;
  riskNote?: string | null;
}

export interface ProjectCopyPair {
  zh: CopyRow | null;
  en: CopyRow | null;
}

export function pickLocalizedCopy(copy: ProjectCopyPair, fallbackDescription: string | null = null) {
  const zh = copy.zh;
  const en = copy.en;

  return {
    hook: {
      zh: zh?.hook ?? null,
      en: en?.hook ?? null,
    },
    oneLiner: {
      zh: zh?.oneLiner ?? null,
      en: en?.oneLiner ?? fallbackDescription ?? null,
    },
    targetUsers: {
      zh: zh?.targetUsers ?? [],
      en: en?.targetUsers ?? [],
    },
    whyNow: {
      zh: zh?.whyNow ?? [],
      en: en?.whyNow ?? [],
    },
    notFor: {
      zh: zh?.notFor ?? [],
      en: en?.notFor ?? [],
    },
    capabilities: {
      zh: zh?.capabilities ?? [],
      en: en?.capabilities ?? [],
    },
    installHint: {
      zh: zh?.installHint ?? null,
      en: en?.installHint ?? null,
    },
    riskNote: {
      zh: zh?.riskNote ?? null,
      en: en?.riskNote ?? null,
    },
  };
}
