import { auth } from "@/auth";
import { Landing } from "@/components/Landing";

export default async function Home() {
  const session = await auth();
  return <Landing userEmail={session?.user?.email ?? null} />;
}
