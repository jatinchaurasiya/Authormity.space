import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // ── Session guard ────────────────────────────────────────────────────────
    // Runs in the Next.js Node.js runtime (NOT Edge) — safe to use Supabase SSR
    const supabase = await createServerSupabaseClient()
    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
        redirect('/login')
    }



    return <div className="flex min-h-screen">{children}</div>
}
