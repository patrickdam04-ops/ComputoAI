import { SignedIn, SignedOut, RedirectToSignIn, UserButton } from "@clerk/nextjs";
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
        <header className="flex w-full justify-between items-center p-4 bg-white shadow-sm">
          <h1 className="text-lg font-semibold text-slate-800">Computo AI</h1>
          <div className="flex items-center gap-3">
            <CreditBadge />
            <UserButton />
          </div>
        </header>
        <ComputoApp />
      </SignedIn>
    </>
  );
}
