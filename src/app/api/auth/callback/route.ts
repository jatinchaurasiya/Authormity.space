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
    try {
        const { searchParams } = new URL(req.url)

        // Handle OAuth-level errors from LinkedIn
        const oauthError = searchParams.get('error')
        if (oauthError) {
            return errorRedirect(req, oauthError)
        }

        const code = searchParams.get('code')
        const state = searchParams.get('state')

        if (!code || !state) {
            return errorRedirect(req, 'missing_params')
        }

        // ── CSRF state validation ─────────────────────────────────────────
        const cookieStore = await cookies()
        const storedState = cookieStore.get(STATE_COOKIE)?.value

        if (!storedState || storedState !== state) {
            return errorRedirect(req, 'state_mismatch')
        }

        // Clear state cookie immediately
        cookieStore.delete(STATE_COOKIE)

        // ── Env guard ─────────────────────────────────────────────────────
        if (!process.env.TOKEN_ENCRYPTION_KEY) {
            return new NextResponse(
                JSON.stringify({ error: 'Authentication failed' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // ── Token exchange ────────────────────────────────────────────────
        const tokens = await exchangeCodeForToken(code)

        if (!tokens.access_token) {
            return new NextResponse(
                JSON.stringify({ error: 'Authentication failed' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // ── Fetch LinkedIn profile ────────────────────────────────────────
        const profile = await getLinkedInProfile(tokens.access_token)

        // ── Encrypt tokens ────────────────────────────────────────────────
        const encryptedAccess = encrypt(tokens.access_token)
        const encryptedRefresh = tokens.refresh_token
            ? encrypt(tokens.refresh_token)
            : null
        const tokenExpiresAt = new Date(
            Date.now() + tokens.expires_in * 1000
        ).toISOString()

        const supabase = createAdminClient()

        // ── Resolve Supabase user ─────────────────────────────────────────
        type ProfileRow = { id: string; onboarding_completed: boolean }
        let supabaseUserId: string
        let isNewUser = false

        // 1) Look up by LinkedIn person ID
        const { data: byLinkedIn } = await supabase
            .from('profiles')
            .select('id, onboarding_completed')
            .eq('linkedin_person_id', profile.id)
            .maybeSingle() as { data: ProfileRow | null }

        if (byLinkedIn) {
            supabaseUserId = byLinkedIn.id
        } else {
            // 2) Look up by email
            const { data: byEmail } = await supabase
                .from('profiles')
                .select('id, onboarding_completed')
                .eq('email', profile.email)
                .maybeSingle() as { data: ProfileRow | null }

            if (byEmail) {
                supabaseUserId = byEmail.id
            } else {
                // 3) Create new Supabase auth user
                const { data: newUser, error: createError } = await supabase
                    .auth.admin.createUser({
                        email: profile.email,
                        email_confirm: true,
                        user_metadata: { name: profile.name },
                    })

                if (createError || !newUser.user) {
                    return new NextResponse(
                        JSON.stringify({ error: 'Authentication failed' }),
                        { status: 500, headers: { 'Content-Type': 'application/json' } }
                    )
                }

                supabaseUserId = newUser.user.id
                isNewUser = true
            }
        }

        // ── Upsert profile ────────────────────────────────────────────────
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
                JSON.stringify({ error: 'Authentication failed' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // ── Create session via magic link ─────────────────────────────────
        const { data: linkData, error: linkError } = await supabase
            .auth.admin.generateLink({
                type: 'magiclink',
                email: profile.email,
            })

        if (linkError || !linkData.properties?.hashed_token) {
            return new NextResponse(
                JSON.stringify({ error: 'Authentication failed' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // ── Build redirect response ───────────────────────────────────────
        const destination = isNewUser || !(byLinkedIn?.onboarding_completed ?? false)
            ? '/onboarding'
            : '/dashboard'

        const response = NextResponse.redirect(new URL(destination, req.url))

        response.cookies.set('sb-token', linkData.properties.hashed_token, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 days
        })

        return response
    } catch (error) {
        // Log server-side only — never expose internals to client
        console.error('[OAuth callback error]', error)

        return new NextResponse(
            JSON.stringify({ error: 'Authentication failed' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
}
