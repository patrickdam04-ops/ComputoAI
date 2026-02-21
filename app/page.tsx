import { SignedIn, SignedOut, RedirectToSignIn, UserButton } from "@clerk/nextjs";
import Link from "next/link";
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
        <div className="min-h-screen bg-slate-50 relative">
          <header className="fixed top-0 left-0 w-full bg-white shadow-md border-b z-[100] flex justify-between items-center px-4 md:px-8 h-16">
            <h1 className="text-xl font-bold text-slate-800">Computo AI</h1>
            <div className="flex items-center gap-3">
              <Link
                href="/archivio"
                className="hidden md:inline-flex rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-800"
              >
                Archivio
              </Link>
              <CreditBadge />
              <UserButton afterSignOutUrl="/" />
            </div>
          </header>

          <main className="pt-24 pb-12 px-4 md:px-8 w-full flex flex-col items-center">
            <ComputoApp />
          </main>
        </div>
      </SignedIn>
    </>
  );
}
