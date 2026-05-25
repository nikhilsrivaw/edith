"use client";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Clock,
  Layers,
  Link as LinkIcon,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { motion } from "motion/react";
import { Fragment, useMemo } from "react";

import { NavBar } from "@/components/edith/nav-bar";
import { PageBackground } from "@/components/edith/page-background";
import { SpotlightCard } from "@/components/spectrum-ui/spotlight-card";
import { DOCS, getDoc, getNeighbours, type DocSection } from "../_content";

export default function DocArticlePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const article = useMemo(() => (slug ? getDoc(slug) : undefined), [slug]);

  if (!article) {
    notFound();
  }

  const { prev, next } = getNeighbours(article.slug);
  const Icon = article.icon;

  return (
    <>
      <PageBackground />
      <NavBar />
      <main className="relative z-10 flex-1 overflow-x-hidden">
        <article className="relative pt-14">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-12 pt-16 lg:grid-cols-[1fr_220px] lg:pt-24">
            {/* Article column */}
            <div className="min-w-0">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                <Link href="/docs" className="hover:text-[var(--text)]">
                  Docs
                </Link>
                <ChevronRight className="h-3 w-3" strokeWidth={2} />
                <span className="text-[var(--text-dim)]">{article.title}</span>
              </nav>

              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mt-6"
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.025em] text-[var(--text)] sm:text-[44px]">
                      {article.title}
                    </h1>
                    <p className="mt-3 max-w-2xl text-[15px] leading-[1.6] text-[var(--text-dim)]">
                      {article.description}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-4 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3 w-3" strokeWidth={1.75} />
                        {article.estimatedRead} read
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Layers className="h-3 w-3" strokeWidth={1.75} />
                        {article.sections.length} sections
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Sections */}
              <div className="mt-12 flex flex-col gap-12">
                {article.sections.map((s, i) => (
                  <motion.section
                    id={s.id}
                    key={s.id}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "0px 0px -10% 0px" }}
                    transition={{ duration: 0.45, delay: Math.min(i * 0.04, 0.2) }}
                    className="scroll-mt-24"
                  >
                    <div className="flex items-center gap-3">
                      <span aria-hidden className="h-4 w-[2px] bg-[var(--accent)]" />
                      <h2 className="text-[22px] font-semibold tracking-[-0.015em] text-[var(--text)]">
                        {s.title}
                      </h2>
                      <a
                        href={`#${s.id}`}
                        className="ml-1 text-[var(--text-muted)] opacity-0 transition-opacity hover:text-[var(--accent)] group-hover:opacity-100"
                        aria-label="Link to section"
                      >
                        <LinkIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </a>
                    </div>
                    <div className="mt-4 max-w-[68ch]">
                      <BodyRenderer body={s.body} />
                    </div>
                    {s.code && <CodeBlock code={s.code} lang={s.codeLang} />}
                  </motion.section>
                ))}
              </div>

              {/* Prev / next */}
              <div className="mt-16 grid gap-3 border-t border-[var(--border)] pt-8 sm:grid-cols-2">
                {prev ? (
                  <Link
                    href={`/docs/${prev.slug}`}
                    className="group flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)]/60 p-4 transition-colors hover:border-[var(--border-hot)]"
                  >
                    <span className="inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      <ArrowLeft className="h-3 w-3" strokeWidth={1.75} />
                      Previous
                    </span>
                    <span className="text-[14px] font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
                      {prev.title}
                    </span>
                  </Link>
                ) : (
                  <div />
                )}
                {next ? (
                  <Link
                    href={`/docs/${next.slug}`}
                    className="group flex flex-col items-end gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)]/60 p-4 text-right transition-colors hover:border-[var(--border-hot)]"
                  >
                    <span className="inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Next
                      <ArrowRight className="h-3 w-3" strokeWidth={1.75} />
                    </span>
                    <span className="text-[14px] font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
                      {next.title}
                    </span>
                  </Link>
                ) : (
                  <div />
                )}
              </div>

              {/* Related */}
              {article.related.length > 0 && (
                <div className="mt-12 border-t border-[var(--border)] pt-8">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
                    Related
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {article.related.map((slug) => {
                      const r = DOCS.find((d) => d.slug === slug);
                      if (!r) return null;
                      const RIcon = r.icon;
                      return (
                        <Link key={slug} href={`/docs/${r.slug}`}>
                          <SpotlightCard className="h-full p-4">
                            <div className="flex items-center gap-3">
                              <div className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--accent)]">
                                <RIcon
                                  className="h-3.5 w-3.5"
                                  strokeWidth={1.75}
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-[13px] font-medium text-[var(--text)]">
                                  {r.title}
                                </div>
                                <div className="truncate font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                                  {r.estimatedRead}
                                </div>
                              </div>
                              <ArrowRight
                                className="ml-auto h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]"
                                strokeWidth={2}
                              />
                            </div>
                          </SpotlightCard>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* On-this-page (right rail) */}
            <aside className="hidden lg:block">
              <div className="sticky top-20">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
                  On this page
                </div>
                <nav className="mt-3 flex flex-col gap-1.5 border-l border-[var(--border)] pl-3">
                  {article.sections.map((s) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className="truncate text-[12px] text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]"
                    >
                      {s.title}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          </div>
        </article>

        <Footer />
      </main>
    </>
  );
}

/* ============================================================
 * Lightweight markdown-ish body renderer.
 * Handles: paragraphs, - bullets, 1. ordered lists, > callouts,
 * `inline code`, **bold**.
 * ============================================================ */

function BodyRenderer({ body }: { body: string }) {
  const blocks = body
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-4 text-[14.5px] leading-[1.65] text-[var(--text-dim)]">
      {blocks.map((b, i) => {
        // Callout
        if (b.startsWith("> ")) {
          return (
            <div
              key={i}
              className="rounded-md border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-[13.5px] text-[var(--text)]"
            >
              <Inline text={b.replace(/^>\s*/, "")} />
            </div>
          );
        }

        // Ordered list (every line starts with N. )
        if (b.split("\n").every((l) => /^\d+\.\s/.test(l))) {
          const items = b.split("\n").map((l) => l.replace(/^\d+\.\s/, ""));
          return (
            <ol
              key={i}
              className="list-inside list-decimal space-y-1.5 text-[14px] marker:text-[var(--accent)]"
            >
              {items.map((it, k) => (
                <li key={k} className="text-[var(--text)]">
                  <Inline text={it} />
                </li>
              ))}
            </ol>
          );
        }

        // Bullet list (every line starts with - )
        if (b.split("\n").every((l) => /^-\s/.test(l))) {
          const items = b.split("\n").map((l) => l.replace(/^-\s/, ""));
          return (
            <ul key={i} className="flex flex-col gap-2 text-[14px]">
              {items.map((it, k) => (
                <li
                  key={k}
                  className="flex items-start gap-3 text-[var(--text)]"
                >
                  <span
                    aria-hidden
                    className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]"
                  />
                  <span className="min-w-0 flex-1">
                    <Inline text={it} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        // Paragraph
        return (
          <p key={i}>
            <Inline text={b} />
          </p>
        );
      })}
    </div>
  );
}

/** Inline formatter — handles **bold** and `code` markers. */
function Inline({ text }: { text: string }) {
  // Split by `code` first, then by **bold** within each non-code chunk.
  const codeParts = text.split(/(`[^`]+`)/);
  return (
    <>
      {codeParts.map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded border border-[var(--border)] bg-[var(--bg-elev)] px-1.5 py-0.5 font-mono text-[12.5px] text-[var(--accent)]"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        const boldParts = part.split(/(\*\*[^*]+\*\*)/);
        return (
          <Fragment key={i}>
            {boldParts.map((bp, j) => {
              if (bp.startsWith("**") && bp.endsWith("**")) {
                return (
                  <strong
                    key={j}
                    className="font-semibold text-[var(--text)]"
                  >
                    {bp.slice(2, -2)}
                  </strong>
                );
              }
              return <Fragment key={j}>{bp}</Fragment>;
            })}
          </Fragment>
        );
      })}
    </>
  );
}

/** Stylised code block. */
function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elev-2)] px-4 py-2">
        <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          <Terminal className="h-3 w-3" strokeWidth={1.75} />
          {lang ?? "code"}
        </div>
      </div>
      <pre className="overflow-auto p-4 font-mono text-[12.5px] leading-[1.6] text-[var(--text-dim)]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Footer() {
  return (
    <footer className="relative border-t border-[var(--border)] py-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        <div>EDITH · docs v1.0</div>
        <div className="flex items-center gap-4">
          <Link href="/docs" className="hover:text-[var(--text)]">
            ← Back to docs
          </Link>
          <Link
            href="/signin"
            className="text-[var(--accent)] hover:brightness-110"
          >
            Connect GitHub →
          </Link>
        </div>
      </div>
    </footer>
  );
}
