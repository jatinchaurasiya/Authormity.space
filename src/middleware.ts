import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_ROUTES = [
    '/dashboard',
    '/create',
    '/calendar',
    '/library',
    '/analytics',
    '/engage',
    '/clients',
    '/team',
    '/settings',
    '/swipe',
]

const AUTH_ROUTES = ['/login']

// All Supabase SSR auth cookies start with "sb-" and contain "-auth-token".
// We check for any matching cookie rather than hard-coding the project ref.
function hasSupabaseSession(req: NextRequest): boolean {
    for (const [name] of req.cookies) {
        if (name.startsWith('sb-') && name.endsWith('-auth-token')) {
            return true
        }
    }
    // Also cover the older helper format
    return (
        req.cookies.has('sb-access-token') ||
        req.cookies.has('sb-refresh-token')
    )
}

export function middleware(req: NextRequest): NextResponse {
    const { pathname } = req.nextUrl
    const session = hasSupabaseSession(req)

    // Block unauthenticated users from protected routes
    if (!session && PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
        const loginUrl = new URL('/login', req.url)
        loginUrl.searchParams.set('next', pathname)
        return NextResponse.redirect(loginUrl)
    }

    // Redirect authenticated users away from login page
    if (session && AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
}

export const config = {
    // Exclude: static files, Next internals, ALL api routes, webhooks
    matcher: ['/((?!_next|favicon\\.ico|api/).*)'],
}
