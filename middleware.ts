import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
export default clerkMiddleware(async (auth, req) => {
const path = req.nextUrl.pathname;

const isPublic = path.startsWith('/sign-in') ||
path.startsWith('/sign-up') ||
path.startsWith('/api/webhooks/clerk');

if (isPublic) {
return NextResponse.next();
}

const authObject = await auth();
if (!authObject.userId) {
return NextResponse.redirect(new URL('/sign-in', req.url));
}

return NextResponse.next();
});

export const config = {
matcher: [
'/((?!_next|[^?]\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).)',
'/(api|trpc)(.*)',
],
}
