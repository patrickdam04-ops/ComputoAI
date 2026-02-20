import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";
import ComputoApp from "./ComputoApp";
import CreditBadge from "@/components/CreditBadge";

export const dynamic = "force-dynamic";

export default async function Home() {
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <ComputoApp creditBadge={<CreditBadge />} />
      </SignedIn>
    </>
  );
}
