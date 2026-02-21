import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types'

/**
 * Server-side Supabase client for use in:
 * - API Route Handlers
 * - Server Components
 * - Server Actions
 *
 * cookies() is async in Next.js 15 — this function must be awaited.
 */
export async function createServerSupabaseClient() {
    const cookieStore = await cookies()

    return createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options })
                    } catch {
                        // Server Component — can't set cookies, ignore
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options })
                    } catch {
                        // Server Component — can't remove cookies, ignore
                    }
                },
            },
        }
    )
}

/**
 * Supabase Admin client using service role key.
 * Use ONLY in server-side code for admin operations.
 * Never expose to clients.
 */
export function createAdminClient() {
    return createClient<any>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}
