"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, GitBranch } from "lucide-react";
import { useTransition } from "react";

export function RepoFilter({ repos }: { repos: string[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const current = sp.get("repo") ?? "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(sp.toString());
    if (e.target.value) next.set("repo", e.target.value);
    else next.delete("repo");
    startTransition(() => {
      router.push(`/issues${next.toString() ? `?${next.toString()}` : ""}`);
    });
  }

  return (
    <label
      className={`relative inline-flex items-center gap-2 rounded-md border bg-[var(--bg-elev)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
        current
          ? "border-[var(--accent)]/40 text-[var(--text)]"
          : "border-[var(--border)] text-[var(--text-dim)]"
      } ${isPending ? "opacity-60" : ""} hover:border-[var(--border-hot)]`}
    >
      <GitBranch className="h-3 w-3" strokeWidth={1.75} />
      <span className="text-[var(--text-muted)]">Repo</span>
      <select
        value={current}
        onChange={onChange}
        disabled={isPending || repos.length === 0}
        className="cursor-pointer appearance-none bg-transparent pr-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text)] outline-none focus:outline-none [&>option]:bg-[var(--bg-elev)] [&>option]:text-[var(--text)]"
      >
        <option value="">All repos</option>
        {repos.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 h-3 w-3 text-[var(--text-muted)]"
        strokeWidth={1.75}
      />
    </label>
  );
}
