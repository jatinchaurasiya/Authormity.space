import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'

const SCOPE = 'openid profile email w_member_social'
const STATE_COOKIE = 'li_oauth_state'
const STATE_TTL = 60 * 10 // 10 minutes

export async function GET(): Promise<NextResponse> {
    const state = randomBytes(32).toString('hex')

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
        state,
        scope: SCOPE,
    })

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`

    const cookieStore = await cookies()
    cookieStore.set(STATE_COOKIE, state, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: STATE_TTL,
        path: '/',
    })

    return NextResponse.redirect(authUrl)
}
