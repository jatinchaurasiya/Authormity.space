import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types'

// Singleton pattern for client-side Supabase
let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
    if (client) return client

    client = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    return client
}

// Named export for convenience
export const supabase = createClient()
