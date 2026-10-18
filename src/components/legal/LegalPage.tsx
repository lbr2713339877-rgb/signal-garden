import Link from 'next/link';
import { V3Shell } from '@/components/v3/V3Shell';
import { T, type DictKey } from '@/lib/dict';
import { CONTACT_EMAIL, LAST_UPDATED } from '@/lib/site';

export interface LegalSection {
  id: string;
  title: DictKey;
  paragraphs?: DictKey[];
  items?: DictKey[];
  faq?: { q: DictKey; a: DictKey }[];
  links?: { href: string; k: DictKey }[];
}

function LegalFooter({ updated }: { updated: string }) {
  return (
    <footer className="mt-24 border-t border-[var(--glass-1-border)] pt-8">
      <p className="data text-[var(--ink-4)]">
        <T k="legal.lastUpdatedLabel" as="span" fade={false} /> {updated}
      </p>
      <p className="data mt-3 text-[var(--ink-3)]">
        <T k="legal.contactPrompt" as="span" fade={false} />{' '}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-[var(--ink-1)] underline decoration-[var(--glass-2-border)] underline-offset-4 transition-colors duration-[var(--d-micro)] hover:decoration-[var(--ink-1)]"
        >
          {CONTACT_EMAIL}
        </a>
      </p>
    </footer>
  );
}

export function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="mt-20 flex flex-col gap-16">
      {sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="scroll-mt-32 border-t border-[var(--glass-1-border)] pt-8"
        >
          <T k={section.title} as="h2" className="system" fade={false} />
          {section.paragraphs?.map((k) => (
            <T
              key={k}
              k={k}
              as="p"
              className="body mt-5 max-w-[74ch] text-[var(--ink-2)]"
            />
          ))}
          {section.items?.length ? (
            <ul className="mt-6 flex max-w-[78ch] list-disc flex-col gap-3 pl-5 text-[var(--ink-2)]">
              {section.items.map((k) => (
                <T key={k} k={k} as="li" className="body" />
              ))}
            </ul>
          ) : null}
          {section.faq?.length ? (
            <div className="mt-6 flex max-w-[78ch] flex-col gap-2">
              {section.faq.map((item) => (
                <details
                  key={item.q}
                  className="group border-t border-[var(--glass-1-border)] py-4"
                >
                  <summary className="body cursor-pointer list-none pr-8 text-[var(--ink-1)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-2)] [&::-webkit-details-marker]:hidden">
                    <T k={item.q} as="span" fade={false} />
                    <span aria-hidden className="float-right text-[var(--ink-4)] group-open:hidden">+</span>
                    <span aria-hidden className="float-right hidden text-[var(--ink-4)] group-open:inline">−</span>
                  </summary>
                  <T k={item.a} as="p" className="body mt-4 pr-8 text-[var(--ink-3)]" />
                </details>
              ))}
            </div>
          ) : null}
          {section.links?.length ? (
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
              {section.links.map((link) => (
                <Link
                  key={link.href + link.k}
                  href={link.href}
                  className="data text-[var(--ink-1)] underline decoration-[var(--glass-2-border)] underline-offset-4 transition-colors duration-[var(--d-micro)] hover:decoration-[var(--ink-1)]"
                >
                  <T k={link.k} as="span" fade={false} />
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

export function LegalPage({
  kicker,
  title,
  intro,
  sections,
  children,
  compact = false,
  updated = LAST_UPDATED,
}: {
  kicker: DictKey;
  title: DictKey;
  intro: DictKey;
  sections: LegalSection[];
  children?: React.ReactNode;
  compact?: boolean;
  updated?: string;
}) {
  return (
    <V3Shell>
      <main className="mx-auto max-w-[var(--container)] px-[var(--gutter)] pt-[clamp(96px,14vh,180px)] pb-[var(--section-gap)]">
        <T k={kicker} as="p" className="system" fade={false} />
        <T k={title} as="h1" className={compact ? "page-title mt-4" : "display-xl mt-6 max-w-[12ch]"} />
        <T
          k={intro}
          as="p"
          className="body mt-8 max-w-[68ch] text-[var(--ink-2)]"
        />

        {compact ? children : null}
        <nav className="mt-14 flex flex-wrap gap-x-6 gap-y-3 border-y border-[var(--glass-1-border)] py-5">
          <span className="sr-only">
            <T k="legal.sectionsAria" as="span" fade={false} />
          </span>
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="data text-[var(--ink-3)] transition-colors duration-[var(--d-micro)] hover:text-[var(--ink-1)]"
            >
              <T k={section.title} as="span" fade={false} />
            </a>
          ))}
        </nav>

        {!compact ? children : null}

        <LegalSections sections={sections} />
        <LegalFooter updated={updated} />
      </main>
    </V3Shell>
  );
}
