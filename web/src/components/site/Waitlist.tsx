"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Status = "idle" | "loading" | "success" | "error";

export function Waitlist() {
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, channel }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Could not save your email. Try again?");
      }
      setStatus("success");
      setMessage("You're in. We'll DM you with a sample dub of your last video within 48 hours.");
      setEmail("");
      setChannel("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something broke.");
    }
  }

  return (
    <section id="waitlist" className="border-t border-border py-20">
      <div className="mx-auto max-w-3xl px-5 text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Get a free 60-second dub of your last video.
        </h2>
        <p className="mt-3 text-muted-foreground">
          Drop your YouTube/Instagram channel + email. We&apos;ll surprise-dub a recent video
          into Tamil, Telugu, Marathi, and Bengali — no charge, no commitment. First 200
          waitlisters only.
        </p>
        <form onSubmit={handleSubmit} className="mx-auto mt-8 flex max-w-2xl flex-col gap-3">
          <Input
            type="url"
            required
            placeholder="https://youtube.com/@yourchannel  (or instagram.com/yourhandle)"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="email"
              required
              placeholder="you@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="sm:flex-1"
            />
            <Button type="submit" size="lg" disabled={status === "loading"}>
              {status === "loading" ? "Saving…" : "Reserve my spot"}
            </Button>
          </div>
        </form>
        {status !== "idle" && message && (
          <p
            className={
              status === "success"
                ? "mt-4 text-sm text-emerald-600"
                : status === "error"
                ? "mt-4 text-sm text-red-600"
                : "mt-4 text-sm text-muted-foreground"
            }
          >
            {message}
          </p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          By signing up you agree to our terms and DPDP-compliant privacy notice.
        </p>
      </div>
    </section>
  );
}
