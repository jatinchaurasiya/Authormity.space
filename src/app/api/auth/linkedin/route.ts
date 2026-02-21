import { NextResponse } from 'next/server'
import { buildAuthorizationUrl } from '@/lib/linkedin'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'

export async function GET() {
    const state = randomBytes(16).toString('hex')

    // Store state in cookie for CSRF verification (cookies() is async in Next.js 15)
    const cookieStore = await cookies()
    cookieStore.set('linkedin_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10, // 10 minutes
        path: '/',
    })

    const authUrl = buildAuthorizationUrl(state)
    return NextResponse.redirect(authUrl)
}
