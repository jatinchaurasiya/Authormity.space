import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { Database } from '@/types'

// Routes that require authentication
const PROTECTED_ROUTES = ['/dashboard', '/create', '/calendar', '/library', '/analytics', '/engage', '/clients', '/team', '/settings', '/swipe']

// Routes accessible only when NOT authenticated
const AUTH_ROUTES = ['/login']

// Routes that bypass all auth checks
const PUBLIC_ROUTES = ['/', '/api/webhooks']

export async function middleware(req: NextRequest) {
    const res = NextResponse.next()
    const pathname = req.nextUrl.pathname

    // Allow public routes and static files
    if (
        PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith('/api/webhooks')) ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.')
    ) {
        return res
    }

    // Create Supabase client with @supabase/ssr
    let response = NextResponse.next({ request: req })

    const supabase = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return req.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    req.cookies.set({ name, value, ...options })
                    response = NextResponse.next({ request: req })
                    response.cookies.set({ name, value, ...options })
                },
                remove(name: string, options: CookieOptions) {
                    req.cookies.set({ name, value: '', ...options })
                    response = NextResponse.next({ request: req })
                    response.cookies.set({ name, value: '', ...options })
                },
            },
        }
    )

    const {
        data: { session },
    } = await supabase.auth.getSession()

    // Redirect unauthenticated users away from protected routes
    if (!session && PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
        const loginUrl = new URL('/login', req.url)
        loginUrl.searchParams.set('next', pathname)
        return NextResponse.redirect(loginUrl)
    }

    // Redirect authenticated users away from auth routes
    if (session && AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Check onboarding completion for authenticated users in app routes
    if (session && PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', session.user.id)
            .single()

        const profileData = profile as { onboarding_completed: boolean } | null

        if (profileData && !profileData.onboarding_completed && !pathname.startsWith('/onboarding')) {
            return NextResponse.redirect(new URL('/onboarding', req.url))
        }
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
