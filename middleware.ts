import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
export default clerkMiddleware(async (auth, req) => {
const path = req.nextUrl.pathname;

// 1. Definiamo le rotte pubbliche in modo manuale e assoluto
const isPublic = path.startsWith('/sign-in') ||
path.startsWith('/sign-up') ||
path.startsWith('/api/webhooks/clerk');

// 2. Se sei su una pagina pubblica (es. login), passa direttamente senza blocchi
if (isPublic) {
return NextResponse.next();
}

// 3. Se sei su una pagina protetta (es. la home del software), controlla il login
const authObject = await auth();
if (!authObject.userId) {
return NextResponse.redirect(new URL('/sign-in', req.url));
}

return NextResponse.next();
});

export const config = {
matcher: [
// Escludi tutti i file statici, le immagini e le API interne di Next
'/((?!_next|[^?]\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).)',
'/(api|trpc)(.*)',
],
}
