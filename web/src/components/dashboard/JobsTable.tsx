"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Job = {
  id: string;
  status: string;
  sourceLanguage: string;
  targetLanguages: string[];
  durationSeconds: number | null;
  errorMessage: string | null;
  createdAt: string | Date;
  completedAt: string | Date | null;
};

const STATUS_COLOR: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  processing: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  succeeded: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

export function JobsTable({ initialJobs }: { initialJobs: Job[] }) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  // Render-locale-sensitive content only after hydration to avoid
  // server (UTC) vs client (IST) text mismatches → React error #418.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (!jobs.some((j) => j.status === "queued" || j.status === "processing")) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/jobs", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { jobs: Job[] };
        if (!cancelled) setJobs(j.jobs);
      } catch {
        // network blip; next tick will recover
      }
    };
    const id = setInterval(tick, 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [jobs]);

  if (!jobs.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        No jobs yet.{" "}
        <Link href="/dashboard/upload" className="text-primary hover:underline">
          Upload your first video →
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">When</th>
            <th className="px-4 py-3">Source → Targets</th>
            <th className="px-4 py-3">Duration</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-t border-border">
              <td className="px-4 py-3 text-muted-foreground" suppressHydrationWarning>
                {hydrated ? new Date(j.createdAt).toLocaleString("en-IN") : ""}
              </td>
              <td className="px-4 py-3">
                {j.sourceLanguage.toUpperCase()} → {j.targetLanguages.map((t) => t.toUpperCase()).join(", ")}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {j.durationSeconds ? `${j.durationSeconds.toFixed(0)}s` : "—"}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[j.status] ?? "bg-muted"}`}>
                  {j.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <Link href={`/dashboard/jobs/${j.id}`} className="text-primary hover:underline">
                  Open →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
