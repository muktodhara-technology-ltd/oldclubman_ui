import { NextResponse } from 'next/server';

export function middleware(req) {
    // Get the token and explicitly check if it exists
    const token = req.cookies.get('old_token')?.value || "";
    const hasValidToken = token !== undefined && token !== null && token !== "";
    const url = req.nextUrl.clone();
    const authPages = url.pathname.startsWith('/auth/');

    // Handle root path - redirect to login if no valid token
    if (url.pathname === '/' && !hasValidToken) {
        url.pathname = '/auth/login';
        return NextResponse.redirect(url);
    }

    // Allow root path to load gathering page when user has valid token
    // (No redirect needed - gathering page will be rendered at /)

    // Handle protected routes - redirect to login if no valid token
    if (!hasValidToken && !authPages) {
        url.pathname = '/auth/login';
        return NextResponse.redirect(url);
    }

    // Handle auth pages when logged in - redirect to home page
    if (hasValidToken && authPages) {
        url.pathname = '/';
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    // Match all page routes including /<username> profile links
    // Exclude static files, API routes, and Next.js internals
    matcher: [
        '/((?!api|_next/static|_next/image|favicon\\.ico|.*\\..*).*)',
    ],
};
