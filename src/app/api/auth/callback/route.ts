import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase-server'
import { exchangeCodeForToken, getLinkedInProfile } from '@/lib/linkedin'

export async function GET(req: NextRequest) {
    // 1. Create ONE NextResponse.redirect() at top
    // The layout component will naturally redirect the user to /onboarding if needed
    const response = NextResponse.redirect(new URL('/dashboard', req.url))

    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    const cookieStore = await cookies()
    const storedState = cookieStore.get('oauth_state')?.value

    if (!code || !state || !storedState || state !== storedState) {
        return NextResponse.redirect(new URL('/login?error=Invalid_State', req.url))
    }

    try {
        // 2. Exchange LinkedIn code
        const tokens = await exchangeCodeForToken(code)

        // 3. Fetch LinkedIn profile
        const profile = await getLinkedInProfile(tokens.access_token)

        // 4. Use Supabase ADMIN client only for createUser and upsert
        const adminClient = createAdminClient()

        // Attempt to create user if they don't exist
        await adminClient.auth.admin.createUser({
            email: profile.email,
            email_confirm: true,
            user_metadata: {
                full_name: profile.name,
                avatar_url: profile.avatar,
            },
        }).catch(() => {
            // Ignored if user already exists
        })

        // Upsert profile
        await adminClient
            .from('profiles')
            .upsert({
                email: profile.email,
                full_name: profile.name,
                avatar_url: profile.avatar,
                linkedin_person_id: profile.id,
            }, { onConflict: 'email' })

        // 5. Use createServerClient bound to ONE NextResponse instance
        const ssrClient = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        // Cookie handlers must mutate same response reference
                        response.cookies.set({ name, value, ...options })
                    },
                    remove(name: string, options: CookieOptions) {
                        // Cookie handlers must mutate same response reference
                        response.cookies.set({ name, value: '', ...options })
                    },
                },
            }
        )

        // As instructed:
        // Then use createServerClient bound to ONE NextResponse instance
        // Call: await ssrClient.auth.signInWithOtp
        await ssrClient.auth.signInWithOtp({
            email: profile.email,
            options: { shouldCreateUser: false },
        })

        // Clean up oauth_state
        response.cookies.set({ name: 'oauth_state', value: '', maxAge: 0 })

        // Return that single response
        return response

    } catch (err) {
        console.error('LinkedIn OAuth Callback Error:', err)
        return NextResponse.redirect(new URL('/login?error=OAuth_Callback_Failed', req.url))
    }
}
