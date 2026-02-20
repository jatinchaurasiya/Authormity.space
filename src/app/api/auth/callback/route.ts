import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeCodeForTokens, getLinkedInUserInfo, encryptToken } from '@/lib/linkedin'
import { createAdminClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle LinkedIn-side errors
    if (error) {
        return NextResponse.redirect(
            new URL(`/login?error=${error}`, req.url)
        )
    }

    if (!code || !state) {
        return NextResponse.redirect(new URL('/login?error=missing_params', req.url))
    }

    // Verify state parameter to prevent CSRF
    const storedState = cookies().get('linkedin_oauth_state')?.value
    if (!storedState || storedState !== state) {
        return NextResponse.redirect(new URL('/login?error=state_mismatch', req.url))
    }

    // Clear state cookie
    cookies().delete('linkedin_oauth_state')

    try {
        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code)

        // Get user profile from LinkedIn
        const userInfo = await getLinkedInUserInfo(tokens.access_token)

        const supabase = createAdminClient()

        // Calculate token expiry
        const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

        // Check if user exists
        type ProfileRow = { id: string; onboarding_completed: boolean }
        const { data: existingProfileRaw } = await supabase
            .from('profiles')
            .select('id, onboarding_completed')
            .eq('email', userInfo.email)
            .single()
        const existingProfile = existingProfileRaw as ProfileRow | null

        let userId: string
        let isNewUser = false

        if (existingProfile) {
            userId = existingProfile.id
            // Update LinkedIn tokens
            await supabase.from('profiles').update({
                linkedin_person_id: userInfo.sub,
                linkedin_access_token: encryptToken(tokens.access_token),
                linkedin_refresh_token: encryptToken(tokens.refresh_token),
                token_expires_at: tokenExpiresAt,
                name: userInfo.name,
                avatar_url: userInfo.picture,
                headline: (userInfo as { headline?: string }).headline || null,
                updated_at: new Date().toISOString(),
            }).eq('id', userId)
        } else {
            // Create new auth user
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email: userInfo.email,
                email_confirm: true,
                user_metadata: { name: userInfo.name },
            })

            if (createError || !newUser.user) {
                throw new Error(`Failed to create user: ${createError?.message}`)
            }

            userId = newUser.user.id
            isNewUser = true

            // Update profile with LinkedIn data (profile auto-created by trigger)
            await supabase.from('profiles').update({
                name: userInfo.name,
                email: userInfo.email,
                headline: (userInfo as { headline?: string }).headline || null,
                avatar_url: userInfo.picture,
                linkedin_person_id: userInfo.sub,
                linkedin_access_token: encryptToken(tokens.access_token),
                linkedin_refresh_token: encryptToken(tokens.refresh_token),
                token_expires_at: tokenExpiresAt,
            }).eq('id', userId)
        }

        // Create a Supabase session
        const { data: sessionData } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: userInfo.email,
        })

        const redirectTo = isNewUser || !existingProfile?.onboarding_completed
            ? '/onboarding'
            : '/dashboard'

        const response = NextResponse.redirect(new URL(redirectTo, req.url))

        // If we have a session token, set it
        if (sessionData?.properties?.hashed_token) {
            response.cookies.set('sb-access-token', sessionData.properties.hashed_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                path: '/',
            })
        }

        return response
    } catch (err) {
        console.error('OAuth callback error:', err)
        return NextResponse.redirect(new URL('/login?error=callback_failed', req.url))
    }
}
