import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthForm } from "@/components/AuthForm";

export default async function AccederPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await auth();
  const { next } = await searchParams;
  const destino = typeof next === "string" && next.startsWith("/") ? next : "/diagnostico";

  if (session?.user) redirect(destino);

  return (
    <main className="min-h-screen px-5 py-16 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2.5 mb-8 justify-center">
          <span className="h-9 w-9 rounded-xl flex items-center justify-center gold-grad font-display font-bold" style={{ color: "var(--gold-dark)" }}>J</span>
          <span className="font-display text-base">JOTA agency</span>
        </Link>
        <AuthForm next={destino} />
        <p className="mt-6 text-center text-xs" style={{ color: "var(--dim)" }}>
          <Link href="/" className="underline">← Volver al inicio</Link>
        </p>
      </div>
    </main>
  );
}
