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
          <header className="fixed top-0 left-0 w-full bg-white border-b border-slate-200 z-[100] flex justify-between items-center px-4 md:px-8 h-16">
            <h1 className="text-xl font-extrabold tracking-tight text-indigo-900">
              Computo AI
            </h1>
            <div className="flex items-center gap-3">
              <Link
                href="/archivio"
                className="hidden md:inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
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
