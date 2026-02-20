import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware(async () => {
return new Response("IL MIDDLEWARE FUNZIONA!", { status: 200 });
});

export const config = {
matcher: [
'/((?!_next|[^?]\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).)',
'/(api|trpc)(.*)',
],
}
