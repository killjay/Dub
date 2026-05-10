"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ALL_LANGS = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "mr", label: "Marathi" },
  { code: "bn", label: "Bengali" },
  { code: "kn", label: "Kannada" },
  { code: "bho", label: "Bhojpuri" },
] as const;

const VOICES = [
  { id: "warm-female", label: "Warm female" },
  { id: "warm-male", label: "Warm male" },
  { id: "bright-female", label: "Bright female" },
  { id: "bright-male", label: "Bright male" },
];

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<string>("hi");
  const [targets, setTargets] = useState<string[]>(["ta"]);
  const [voice, setVoice] = useState("warm-female");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTarget(code: string) {
    setTargets((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]));
  }

  function changeSource(code: string) {
    setSource(code);
    // If the new source is in the target list, drop it.
    setTargets((cur) => cur.filter((c) => c !== code));
  }

  const targetOptions = ALL_LANGS.filter((l) => l.code !== source);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!file) return setError("Pick a video first.");
    if (file.size > 500 * 1024 * 1024) return setError("File is over 500 MB. Compress and retry.");
    if (targets.length === 0) return setError("Pick at least one target language.");

    // Read the file's bytes into a fresh ArrayBuffer BEFORE any other async work.
    // Why: the File object from <input> is backed by the input element's FileList;
    // browsers may detach the underlying ArrayBuffer if the input re-renders, the
    // page is in the background too long, or the fetch implementation streams the
    // body in chunks and the second chunk arrives after a re-render. Loading the
    // whole file into memory now decouples the upload from the File handle.
    const fileName = file.name;
    const fileType = file.type;
    const fileSize = file.size;
    setSubmitting(true);
    let bodyBlob: Blob;
    try {
      const buf = await file.arrayBuffer();
      bodyBlob = new Blob([buf], { type: fileType || "application/octet-stream" });
    } catch (err) {
      setSubmitting(false);
      return setError(
        "Could not read the file. Please pick it again and retry. " +
          (err instanceof Error ? err.message : "")
      );
    }

    try {
      // Step 1: ask the API for a presigned R2 upload URL.
      const presign = await fetch("/api/jobs/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: fileName, contentType: fileType, sizeBytes: fileSize }),
      });
      if (!presign.ok) throw new Error("Could not start the upload.");
      const { uploadUrl, key } = await presign.json();

      // Step 2: PUT the bytes directly to R2 — using the in-memory Blob.
      const put = await fetch(uploadUrl, {
        method: "PUT",
        body: bodyBlob,
        headers: { "content-type": fileType || "application/octet-stream" },
      });
      if (!put.ok) throw new Error(`Upload to storage failed (${put.status}).`);

      // Step 3: enqueue the job.
      const job = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceR2Key: key, sourceLanguage: source, targetLanguages: targets, voicePreset: voice }),
      });
      if (!job.ok) throw new Error("Could not enqueue the job.");
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something broke.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Drop zone */}
      <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
        <input
          id="video"
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full cursor-pointer text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground hover:file:opacity-90"
        />
        {file && (
          <p className="mt-3 text-xs text-muted-foreground">
            {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
          </p>
        )}
      </div>

      {/* Source */}
      <div>
        <label className="text-sm font-medium">Source language</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALL_LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => changeSource(l.code)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                source === l.code
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Targets */}
      <div>
        <label className="text-sm font-medium">Target languages</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {targetOptions.map((t) => (
            <button
              key={t.code}
              type="button"
              onClick={() => toggleTarget(t.code)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm",
                targets.includes(t.code)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Voice preset */}
      <div>
        <label className="text-sm font-medium">Voice preset</label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {VOICES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVoice(v.id)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                voice === v.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        {submitting ? "Uploading…" : `Dub into ${targets.length} ${targets.length === 1 ? "language" : "languages"}`}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Tip: voice-dominant audio gives the best result. We don&apos;t separate music in v1 — keep BGM low.
      </p>
    </form>
  );
}
