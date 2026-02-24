import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
    const clientId = process.env.LINKEDIN_CLIENT_ID
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI

    if (!clientId || !redirectUri) {
        return NextResponse.json(
            { error: 'Server misconfiguration: LinkedIn credentials missing.' },
            { status: 500 }
        )
    }

    // Generate a cryptographically secure random state
    const state = crypto.randomUUID()

    // Store state in httpOnly cookie
    const cookieStore = await cookies()
    cookieStore.set('oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 10, // 10 minutes
    })

    // Build LinkedIn OAuth URL
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        state: state,
        scope: 'openid profile email w_member_social',
    })

    const linkedInAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`

    return NextResponse.redirect(linkedInAuthUrl)
}
