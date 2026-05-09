import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { AuthForm } from "@/components/auth/AuthForm";
import { getSessionUser } from "@/lib/auth";

export default async function SignUpPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  return (
    <>
      <Nav />
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-5 py-10">
        <Suspense fallback={null}>
          <AuthForm mode="sign-up" />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
