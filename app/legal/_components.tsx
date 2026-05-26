/**
 * Shared primitives for the two legal pages. Server components, no state.
 */

export function Title({
  eyebrow,
  title,
  updated,
}: {
  eyebrow: string;
  title: string;
  updated: string;
}) {
  return (
    <header className="mb-10 border-b border-[var(--border)] pb-8">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
        {eyebrow}
      </div>
      <h1 className="mt-3 text-[36px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--text)]">
        {title}
      </h1>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Last updated: {updated}
      </p>
    </header>
  );
}

export function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-20">
      <h2 className="flex items-baseline gap-3 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">
        <span className="font-mono text-[12px] tabular-nums text-[var(--text-muted)]">
          {String(number).padStart(2, "0")}
        </span>
        {title}
      </h2>
      <div className="prose-edith mt-4 space-y-4 text-[14px] leading-[1.65] text-[var(--text-dim)]">
        {children}
      </div>
    </section>
  );
}

export function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-5 text-[15px] font-semibold text-[var(--text)]">
      {children}
    </h3>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="ml-5 list-disc space-y-2">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function Toc({
  items,
}: {
  items: Array<{ id: string; label: string }>;
}) {
  return (
    <nav
      aria-label="Table of contents"
      className="mb-10 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)]/55 px-5 py-4"
    >
      <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--accent)]">
        On this page
      </div>
      <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {items.map((s, i) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="inline-flex items-baseline gap-2 text-[12.5px] text-[var(--text-dim)] hover:text-[var(--accent)]"
            >
              <span className="font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              {s.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border border-[var(--border)] bg-[var(--bg-elev-2)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--text)]">
      {children}
    </code>
  );
}
