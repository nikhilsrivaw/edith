"use client";
import { AlertCircle, Check, Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type State = "idle" | "scanning" | "done" | "error";

export function ScanButton({
  owner,
  repo,
  className,
}: {
  owner: string;
  repo: string;
  className?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onClick = async () => {
    setState("scanning");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/scans/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        scanId?: string;
        hint?: string;
        error?: string;
      };
      if (!json.ok || !json.scanId) {
        setState("error");
        setErrorMsg(json.hint ?? json.error ?? "Scan failed");
        return;
      }
      setState("done");
      router.push(`/repos/${repo}/scans/${json.scanId}`);
    } catch (e) {
      setState("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className={`flex flex-col items-end gap-1 ${className ?? ""}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={state === "scanning" || state === "done"}
        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
      >
        {state === "scanning" ? (
          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} />
        ) : state === "done" ? (
          <Check className="h-3 w-3" strokeWidth={2.5} />
        ) : state === "error" ? (
          <AlertCircle className="h-3 w-3" strokeWidth={2.5} />
        ) : (
          <Play className="h-3 w-3" strokeWidth={2.5} />
        )}
        {state === "scanning"
          ? "Scanning"
          : state === "done"
            ? "Done"
            : state === "error"
              ? "Retry"
              : "Scan"}
      </button>
      {state === "error" && errorMsg && (
        <span className="max-w-[240px] text-right font-mono text-[9px] leading-snug text-[var(--danger)]">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
