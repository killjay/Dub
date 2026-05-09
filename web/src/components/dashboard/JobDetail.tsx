"use client";

import { useEffect, useState } from "react";

type Job = {
  id: string;
  status: string;
  sourceLanguage: string;
  targetLanguages: string[];
  durationSeconds: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

type Output = {
  id: string;
  language: string;
  videoR2Key: string;
  audioR2Key: string;
  videoUrl: string | null;
  audioUrl: string | null;
};

export function JobDetail({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (!r.ok) {
          if (!cancelled) setError(`Failed to load job (${r.status})`);
          return;
        }
        const j = (await r.json()) as { job: Job; outputs: Output[] };
        if (cancelled) return;
        setJob(j.job);
        setOutputs(j.outputs);
        if (j.job.status === "succeeded" || j.job.status === "failed") return false;
        return true;
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Network error");
        return true;
      }
    };
    const loop = async () => {
      while (!cancelled) {
        const cont = await tick();
        if (cont === false) break;
        await new Promise((r) => setTimeout(r, 4_000));
      }
    };
    loop();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (error) return <p className="mt-6 text-sm text-red-600">{error}</p>;
  if (!job) return <p className="mt-6 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Job {job.id.slice(0, 8)}</h1>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wider">
          {job.status}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {job.sourceLanguage.toUpperCase()} → {job.targetLanguages.map((t) => t.toUpperCase()).join(", ")} ·{" "}
        Created {new Date(job.createdAt).toLocaleString("en-IN")}
      </p>

      {job.errorMessage && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <strong>Error:</strong> {job.errorMessage}
        </div>
      )}

      {job.status === "queued" || job.status === "processing" ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center">
          <div className="mx-auto h-2 w-1/2 overflow-hidden rounded-full bg-muted">
            <div className="h-full animate-pulse bg-primary" style={{ width: job.status === "queued" ? "10%" : "60%" }} />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {job.status === "queued" ? "Queued — waiting for a worker." : "Processing — this usually takes < 8 min per minute of source."}
          </p>
        </div>
      ) : null}

      {outputs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Outputs</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            {outputs.map((o) => (
              <div key={o.id} className="rounded-2xl border border-border bg-background p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium uppercase tracking-wider">{o.language}</span>
                  {o.videoUrl ? (
                    <a href={o.videoUrl} download className="text-xs text-primary hover:underline">
                      Download MP4 ↓
                    </a>
                  ) : null}
                </div>
                {o.videoUrl ? (
                  <video src={o.videoUrl} controls className="aspect-[9/16] w-full max-h-72 rounded-lg bg-black" />
                ) : (
                  <div className="aspect-[9/16] w-full max-h-72 rounded-lg bg-muted" />
                )}
                {o.audioUrl && (
                  <audio src={o.audioUrl} controls className="mt-3 w-full" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
