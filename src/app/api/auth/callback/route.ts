import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { exchangeCodeForToken, getLinkedInProfile } from '@/lib/linkedin'
import { encrypt } from '@/lib/encryption'

const STATE_COOKIE = 'li_oauth_state'

function fail500(): NextResponse {
    return new NextResponse(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
}

function errorRedirect(req: NextRequest, reason: string): NextResponse {
    const url = new URL('/login', req.url)
    url.searchParams.set('error', reason)
    return NextResponse.redirect(url)
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(req.url)

        // Handle OAuth-level errors
        const oauthError = searchParams.get('error')
        if (oauthError) return errorRedirect(req, oauthError)

        const code = searchParams.get('code')
        const state = searchParams.get('state')
        if (!code || !state) return errorRedirect(req, 'missing_params')

        // ── CSRF state validation ─────────────────────────────────────────
        const storedState = req.cookies.get(STATE_COOKIE)?.value
        if (!storedState || storedState !== state) {
            return errorRedirect(req, 'state_mismatch')
        }

        // ── Env guard ─────────────────────────────────────────────────────
        if (!process.env.TOKEN_ENCRYPTION_KEY) return fail500()

        // ── Admin client (service role) — for user management only ────────
        // Does NOT set any session cookies. Never used for auth.getSession().
        const admin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // ── Token exchange ─────────────────────────────────────────────────
        const tokens = await exchangeCodeForToken(code)
        if (!tokens.access_token) return fail500()

        // ── Fetch LinkedIn profile ─────────────────────────────────────────
        const profile = await getLinkedInProfile(tokens.access_token)

        // ── Encrypt LinkedIn tokens ────────────────────────────────────────
        const encryptedAccess = encrypt(tokens.access_token)
        const encryptedRefresh = tokens.refresh_token
            ? encrypt(tokens.refresh_token)
            : null
        const tokenExpiresAt = new Date(
            Date.now() + tokens.expires_in * 1000
        ).toISOString()

        // ── Resolve or create Supabase user ───────────────────────────────
        type ProfileRow = { id: string; onboarding_completed: boolean }
        let supabaseUserId: string
        let isNewUser = false
        let onboardingDone = false

        const { data: byLinkedIn } = await admin
            .from('profiles')
            .select('id, onboarding_completed')
            .eq('linkedin_person_id', profile.id)
            .maybeSingle() as { data: ProfileRow | null }

        if (byLinkedIn) {
            supabaseUserId = byLinkedIn.id
            onboardingDone = byLinkedIn.onboarding_completed
        } else {
            const { data: byEmail } = await admin
                .from('profiles')
                .select('id, onboarding_completed')
                .eq('email', profile.email)
                .maybeSingle() as { data: ProfileRow | null }

            if (byEmail) {
                supabaseUserId = byEmail.id
                onboardingDone = byEmail.onboarding_completed
            } else {
                const { data: newUser, error: createError } = await admin.auth.admin.createUser({
                    email: profile.email,
                    email_confirm: true,
                    user_metadata: { name: profile.name },
                })
                if (createError || !newUser.user) return fail500()

                supabaseUserId = newUser.user.id
                isNewUser = true
            }
        }

        // ── Upsert profile row ────────────────────────────────────────────
        const { error: upsertError } = await admin
            .from('profiles')
            .upsert(
                {
                    id: supabaseUserId,
                    email: profile.email,
                    name: profile.name,
                    avatar_url: profile.avatar,
                    linkedin_person_id: profile.id,
                    linkedin_access_token: encryptedAccess,
                    linkedin_refresh_token: encryptedRefresh,
                    token_expires_at: tokenExpiresAt,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'id' }
            )

        if (upsertError) {
            console.error('[OAuth callback] upsert error:', upsertError)
            return fail500()
        }

        // ── Generate magic-link token (server-side only) ──────────────────
        // We do NOT redirect to the magic link URL.
        // Instead we exchange the hashed_token via verifyOtp()
        // so the SSR client can set proper Supabase session cookies.
        const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email: profile.email,
        })

        if (linkError || !linkData.properties?.hashed_token) {
            console.error('[OAuth callback] generateLink error:', linkError)
            return fail500()
        }

        // ── Build the redirect response first ─────────────────────────────
        const destination = isNewUser || !onboardingDone ? '/onboarding' : '/dashboard'
        const response = NextResponse.redirect(new URL(destination, req.url))

        // Clear the OAuth state cookie
        response.cookies.set(STATE_COOKIE, '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 0,
            path: '/',
        })

        // ── Create SSR client whose cookie handlers write to the response ──
        // This is the ONLY correct way to set Supabase session cookies in
        // an App Router Route Handler. By mutating the same `response` object,
        // all cookies (sb-access-token, sb-refresh-token, etc.) accumulate.
        const ssrClient = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return req.cookies.get(name)?.value
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        req.cookies.set({ name, value, ...options })
                        response.cookies.set({ name, value, ...options })
                    },
                    remove(name: string, options: CookieOptions) {
                        req.cookies.set({ name, value: '', ...options })
                        response.cookies.set({ name, value: '', ...options })
                    },
                },
            }
        )

        // ── Exchange hashed_token for a real Supabase session ─────────────
        // verifyOtp() with token_hash is the PKCE-safe way to turn a
        // server-generated magic link into real sb-access-token /
        // sb-refresh-token cookies without any client-side redirect.
        const { error: sessionError } = await ssrClient.auth.verifyOtp({
            token_hash: linkData.properties.hashed_token,
            type: 'magiclink',
        })

        if (sessionError) {
            console.error('[OAuth callback] verifyOtp error:', sessionError)
            return fail500()
        }

        // response now carries real sb-access-token + sb-refresh-token cookies
        return response

    } catch (error) {
        console.error('[OAuth callback] unexpected error:', error)
        return fail500()
    }
}
