import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as createRawClient } from '@supabase/supabase-js'
import OnboardingWizard from './wizard'

// ── Server Component ───────────────────────────────────────────────────────
// This page is the direct OAuth redirect target from Supabase LinkedIn OAuth.
// Supabase appends ?code=<pkce_code> to this URL.
// We exchange that code for a session, seed the profile row if missing,
// then render the onboarding wizard. No cookies are manipulated manually.

interface Props {
    searchParams: Promise<{ code?: string; error?: string }>
}

export default async function OnboardingPage({ searchParams }: Props) {
    const params = await searchParams
    const cookieStore = await cookies()

    // ── Build SSR client wired to Next.js cookies ─────────────────────────
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // setAll() may throw in read-only route segments; ignore.
                    }
                },
            },
        }
    )

    // ── Exchange PKCE code for session (first visit after OAuth consent) ───
    // Supabase appends ?code=<pkce_code> when redirecting back here.
    // Calling exchangeCodeForSession() sets the real sb-access-token cookies.
    if (params.code) {
        await supabase.auth.exchangeCodeForSession(params.code)
    }

    // ── Guard: must be authenticated ─────────────────────────────────────
    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
        redirect('/login')
    }

    const { user } = session

    // ── Seed profile row for first-time OAuth users ───────────────────────
    // Native Supabase OAuth does NOT auto-insert into the `profiles` table.
    // We use the raw client (no typed generics) to avoid Postgrest v12 `never`
    // inference issues. No service role key — the anon key + RLS is sufficient
    // because RLS policies allow a user to INSERT their own row.
    const rawClient = createRawClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                persistSession: false,
                // Pass the active access token so RLS sees the correct user
                // Supabase JS will include it in Authorization headers as long
                // as we pass `global.headers`.
            },
            global: {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            },
        }
    )

    const profilePayload: Record<string, unknown> = {
        id: user.id,
        email: user.email ?? '',
        name:
            user.user_metadata?.name ??
            user.user_metadata?.full_name ??
            '',
        avatar_url: user.user_metadata?.avatar_url ?? null,
    }

    const { error: upsertError } = await rawClient
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id', ignoreDuplicates: true })

    if (upsertError) {
        console.error('[onboarding] profile upsert error:', upsertError)
        // Non-fatal — wizard submit will retry the update
    }

    // ── Skip wizard if already onboarded ─────────────────────────────────
    const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .maybeSingle()

    const profileData = profile as { onboarding_completed: boolean } | null

    if (profileData?.onboarding_completed) {
        redirect('/dashboard')
    }

    return <OnboardingWizard />
}
