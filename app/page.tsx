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
        <div className="min-h-screen flex flex-col bg-slate-50">
          <header className="flex w-full justify-between items-center p-4 bg-white shadow-sm border-b z-50">
            <h1 className="text-xl font-bold text-slate-800">Computo AI</h1>
            <div className="flex items-center gap-4">
              <CreditBadge />
              <UserButton afterSignOutUrl="/" />
            </div>
          </header>

          <main className="flex-grow p-4 md:p-8 max-md:overflow-hidden">
            <ComputoApp />
          </main>
        </div>
      </SignedIn>
    </>
  );
}
