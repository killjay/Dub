import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { JobsTable } from "@/components/dashboard/JobsTable";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireUser();
  const dbi = db();
  const jobs = await dbi
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.userId, user.id))
    .orderBy(desc(schema.jobs.createdAt))
    .limit(20);

  const inFlight = jobs.filter((j) => j.status === "queued" || j.status === "processing").length;
  const remaining = Math.max(0, user.minutesQuota - user.minutesUsedThisMonth);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Your dubs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.plan[0].toUpperCase() + user.plan.slice(1)} plan ·{" "}
              {user.minutesUsedThisMonth.toFixed(0)} of {user.minutesQuota} minutes used this month
            </p>
          </div>
          <Link href="/dashboard/upload">
            <Button>New dub</Button>
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Minutes remaining</CardTitle>
              <CardDescription>Resets on the 1st of each month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{remaining}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Jobs in flight</CardTitle>
              <CardDescription>Live status updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{inFlight}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plan</CardTitle>
              <CardDescription>UPI AutoPay · cancel anytime</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{user.plan[0].toUpperCase() + user.plan.slice(1)}</div>
              <Link href="/#pricing" className="mt-2 inline-block text-sm text-primary hover:underline">
                Upgrade →
              </Link>
            </CardContent>
          </Card>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Recent jobs</h2>
          <div className="mt-3">
            <JobsTable initialJobs={jobs} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
