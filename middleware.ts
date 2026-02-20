import { clerkMiddleware } from '@clerk/nextjs/server'
// Il middleware si limita ad "accendere" Clerk. Il blocco degli accessi è già gestito in page.tsx
export default clerkMiddleware();

export const config = {
// Matcher assoluto: intercetta qualsiasi path, zero eccezioni.
matcher: ["/(.*)"],
}
