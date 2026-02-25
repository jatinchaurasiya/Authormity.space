import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const metadata = {
    title: 'Dashboard | Authormity',
}

export default async function DashboardPage() {
    // 1. Get session using server-side client
    const supabase = await createServerSupabaseClient()


    const {
        data: { session },
    } = await supabase.auth.getSession()

    console.log("SESSION USER ID:", session?.user?.id)

    // 2. Require session
    if (!session) {
        redirect('/login')
    }

    // 3. Fetch profile (name, plan, posts_used_this_month, onboarding_completed)
    const { data: profile } = await supabase
        .from('profiles')
        .select('name, plan, posts_used_this_month, onboarding_completed')
        .eq('id', session.user.id)
        .single()

    console.log("PROFILE FETCH RESULT:", profile)

    const typedProfile = profile as { name: string; plan: string; posts_used_this_month: number; onboarding_completed: boolean } | null

    if (typedProfile?.onboarding_completed === false) {
        redirect('/onboarding')
    }

    // 4. Fetch posts (id, content, status, created_at)
    // Filter by user_id, order by created_at DESC, limit 10
    const { data: posts } = await supabase
        .from('posts')
        .select('id, content, status, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10)

    // Fallbacks to satisfy strict TS
    const safeProfile = profile || { name: 'Creator', plan: 'Free', posts_used_this_month: 0, onboarding_completed: false }

    type PostRecord = {
        id: string
        content: string
        status: string
        created_at: string
    }

    const safePosts: PostRecord[] = posts || []

    return (
        <div className="mx-auto w-full max-w-5xl px-6 py-10">
            {/* Top Section */}
            <header className="mb-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        Welcome back, {safeProfile.name}
                    </h1>
                    <div className="mt-3 flex items-center gap-3 text-sm">
                        <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 font-medium text-blue-400">
                            {safeProfile.plan} Plan
                        </span>
                        <span className="text-white/60">
                            {safeProfile.posts_used_this_month} posts used this month
                        </span>
                    </div>
                </div>

                <Link
                    href="/create/post"
                    className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 hover:shadow-blue-500/40 active:scale-[0.98]"
                >
                    Create LinkedIn Post
                </Link>
            </header>

            {/* Post List Section */}
            <section>
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white/90">Recent Posts</h2>
                </div>

                {safePosts.length === 0 ? (
                    // Empty State
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] py-24 text-center">
                        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-white/40">
                            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-white">No posts yet</h3>
                        <p className="mt-2 max-w-sm text-sm text-white/50">
                            Your first post is waiting to be created. Start sharing your expertise with your network.
                        </p>
                        <Link
                            href="/create/post"
                            className="mt-6 font-medium text-blue-400 transition-colors hover:text-blue-300"
                        >
                            Write your first post &rarr;
                        </Link>
                    </div>
                ) : (
                    // Posts List
                    <div className="grid gap-4">
                        {safePosts.map((post) => {
                            // Extract first 80 characters
                            const truncatedContent =
                                post.content.length > 80
                                    ? post.content.substring(0, 80) + '...'
                                    : post.content

                            // Format the created date
                            const formattedDate = new Date(post.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                            })

                            // Determine status badge colors
                            let badgeStyles = 'bg-white/10 text-white/70 border-white/10'
                            if (post.status.toLowerCase() === 'published') {
                                badgeStyles = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            } else if (post.status.toLowerCase() === 'scheduled') {
                                badgeStyles = 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            } else if (post.status.toLowerCase() === 'draft') {
                                badgeStyles = 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                            }

                            return (
                                <div
                                    key={post.id}
                                    className="group flex flex-col justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.03] p-5 transition-all hover:border-white/10 sm:flex-row sm:items-center"
                                >
                                    <div className="flex-1">
                                        <p className="text-sm leading-relaxed text-white/80">
                                            {truncatedContent}
                                        </p>
                                        <div className="mt-2 flex items-center gap-3 text-xs text-white/40">
                                            <span>Created on {formattedDate}</span>
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 items-center">
                                        <span
                                            className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${badgeStyles}`}
                                        >
                                            {post.status}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>
        </div>
    )
}
