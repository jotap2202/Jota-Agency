import { auth } from "@/auth";
import { Landing } from "@/components/Landing";
import { googleConfigurado } from "@/lib/config-auth";

export default async function Home() {
  const session = await auth();
  return <Landing userEmail={session?.user?.email ?? null} google={googleConfigurado()} />;
}
