import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeCodeForToken, getLinkedInProfile } from '@/lib/linkedin'
import { encrypt } from '@/lib/encryption'
import { createAdminClient } from '@/lib/supabase-server'

const STATE_COOKIE = 'li_oauth_state'

function errorRedirect(req: NextRequest, reason: string): NextResponse {
    const url = new URL('/login', req.url)
    url.searchParams.set('error', reason)
    return NextResponse.redirect(url)
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    const { searchParams } = new URL(req.url)

    const oauthError = searchParams.get('error')
    if (oauthError) {
        return errorRedirect(req, oauthError)
    }

    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code || !state) {
        return errorRedirect(req, 'missing_params')
    }

    // ── Validate CSRF state ──────────────────────────────────
    const cookieStore = await cookies()
    const storedState = cookieStore.get(STATE_COOKIE)?.value

    if (!storedState || storedState !== state) {
        return errorRedirect(req, 'state_mismatch')
    }

    // Clear state cookie immediately after validation
    cookieStore.delete(STATE_COOKIE)

    // ── Exchange code for tokens ─────────────────────────────
    let tokens: Awaited<ReturnType<typeof exchangeCodeForToken>>
    let profile: Awaited<ReturnType<typeof getLinkedInProfile>>

    try {
        tokens = await exchangeCodeForToken(code)
        profile = await getLinkedInProfile(tokens.accessToken)
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return new NextResponse(
            JSON.stringify({ error: 'token_exchange_failed', detail: message }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
        )
    }

    // ── Encrypt tokens before storage ────────────────────────
    const encryptedAccess = encrypt(tokens.accessToken)
    const encryptedRefresh = encrypt(tokens.refreshToken)
    const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString()

    const supabase = createAdminClient()

    // ── Resolve Supabase user ────────────────────────────────
    let supabaseUserId: string
    let isNewUser = false

    // Try to find an existing profile by LinkedIn person ID
    type ProfileRow = { id: string; onboarding_completed: boolean }
    const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, onboarding_completed')
        .eq('linkedin_person_id', profile.id)
        .maybeSingle() as { data: ProfileRow | null }

    if (existingProfile) {
        supabaseUserId = existingProfile.id
    } else {
        // Look up by email (user may have signed up another way)
        const { data: profileByEmail } = await supabase
            .from('profiles')
            .select('id, onboarding_completed')
            .eq('email', profile.email)
            .maybeSingle() as { data: ProfileRow | null }

        if (profileByEmail) {
            supabaseUserId = profileByEmail.id
        } else {
            // New user — create Supabase auth account
            const { data: newUser, error: createError } = await supabase
                .auth.admin.createUser({
                    email: profile.email,
                    email_confirm: true,
                    user_metadata: { name: profile.name },
                })

            if (createError || !newUser.user) {
                return new NextResponse(
                    JSON.stringify({ error: 'user_creation_failed', detail: createError?.message }),
                    { status: 500, headers: { 'Content-Type': 'application/json' } }
                )
            }

            supabaseUserId = newUser.user.id
            isNewUser = true
        }
    }

    // ── Upsert profile with LinkedIn data ────────────────────
    const { error: upsertError } = await supabase
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
        return new NextResponse(
            JSON.stringify({ error: 'profile_upsert_failed', detail: upsertError.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }

    // ── Generate magic link to create a session ──────────────
    const { data: linkData, error: linkError } = await supabase
        .auth.admin.generateLink({
            type: 'magiclink',
            email: profile.email,
        })

    if (linkError || !linkData.properties?.hashed_token) {
        return new NextResponse(
            JSON.stringify({ error: 'session_creation_failed', detail: linkError?.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }

    // ── Determine redirect destination ───────────────────────
    const destination = isNewUser || !(existingProfile?.onboarding_completed ?? false)
        ? '/onboarding'
        : '/dashboard'

    const response = NextResponse.redirect(new URL(destination, req.url))

    // Set the Supabase session token as an httpOnly cookie
    response.cookies.set('sb-token', linkData.properties.hashed_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
}
