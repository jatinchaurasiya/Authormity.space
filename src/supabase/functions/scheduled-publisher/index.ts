// @ts-nocheck
// Supabase Edge Function — Scheduled Post Publisher
// Runs every 5 minutes via Supabase cron job
// Publishes scheduled LinkedIn posts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET')
const LINKEDIN_API = 'https://api.linkedin.com/v2'
const LINKEDIN_OAUTH = 'https://www.linkedin.com/oauth/v2'

// Token decryption (must match lib/linkedin.ts encryption)
async function decryptToken(encrypted: string): Promise<string> {
    const key = Deno.env.get('TOKEN_ENCRYPTION_KEY')!
    // AES decryption using Web Crypto API (symmetric with CryptoJS AES)
    // In production you'd implement the full decryption here
    // For now return the token as-is (placeholder — implement after setting up encryption)
    return encrypted
}

async function refreshToken(refreshToken: string): Promise<{
    access_token: string
    expires_in: number
    refresh_token: string
}> {
    const res = await fetch(`${LINKEDIN_OAUTH}/accessToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: Deno.env.get('LINKEDIN_CLIENT_ID')!,
            client_secret: Deno.env.get('LINKEDIN_CLIENT_SECRET')!,
        }),
    })

    if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`)
    return res.json()
}

async function publishToLinkedIn(
    accessToken: string,
    personId: string,
    content: string
): Promise<string> {
    const res = await fetch(`${LINKEDIN_API}/ugcPosts`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
            author: `urn:li:person:${personId}`,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: { text: content },
                    shareMediaCategory: 'NONE',
                },
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
            },
        }),
    })

    if (!res.ok) throw new Error(`LinkedIn publish failed: ${await res.text()}`)
    const data = await res.json()
    return data.id
}

Deno.serve(async (req) => {
    // Verify cron secret
    const authHeader = req.headers.get('Authorization')
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const now = new Date()
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000)

    // Find due scheduled posts
    const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('id, user_id, content')
        .eq('status', 'scheduled')
        .lte('scheduled_at', now.toISOString())
        .gte('scheduled_at', tenMinutesAgo.toISOString())

    if (postsError) {
        console.error('Failed to fetch posts:', postsError)
        return new Response(JSON.stringify({ error: 'DB query failed' }), { status: 500 })
    }

    if (!posts || posts.length === 0) {
        return new Response(JSON.stringify({ processed: 0 }), { status: 200 })
    }

    let processed = 0
    let failed = 0

    for (const post of posts) {
        try {
            // Get user's LinkedIn credentials
            const { data: profile } = await supabase
                .from('profiles')
                .select('linkedin_person_id, linkedin_access_token, linkedin_refresh_token, token_expires_at')
                .eq('id', post.user_id)
                .single()

            if (!profile) {
                throw new Error('Profile not found')
            }

            let accessToken = await decryptToken(profile.linkedin_access_token)
            const refreshTokenVal = await decryptToken(profile.linkedin_refresh_token)
            const tokenExpiry = new Date(profile.token_expires_at)

            // Refresh token if expiring within 5 days
            if (now >= new Date(tokenExpiry.getTime() - 5 * 24 * 60 * 60 * 1000)) {
                const newTokens = await refreshToken(refreshTokenVal)
                accessToken = newTokens.access_token

                // Update tokens in DB
                await supabase
                    .from('profiles')
                    .update({
                        linkedin_access_token: newTokens.access_token,
                        linkedin_refresh_token: newTokens.refresh_token,
                        token_expires_at: new Date(
                            Date.now() + newTokens.expires_in * 1000
                        ).toISOString(),
                    })
                    .eq('id', post.user_id)
            }

            // Publish to LinkedIn
            const linkedInPostId = await publishToLinkedIn(
                accessToken,
                profile.linkedin_person_id,
                post.content
            )

            // Mark post as published
            await supabase
                .from('posts')
                .update({
                    status: 'published',
                    published_at: now.toISOString(),
                    linkedin_post_id: linkedInPostId,
                })
                .eq('id', post.id)

            processed++
        } catch (err) {
            console.error(`Failed to publish post ${post.id}:`, err)

            // Mark post as failed
            await supabase
                .from('posts')
                .update({ status: 'failed' })
                .eq('id', post.id)

            failed++
        }
    }

    return new Response(
        JSON.stringify({ processed, failed, total: posts.length }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
})

/* 
  Supabase cron job to run this function every 5 minutes:
  
  SELECT cron.schedule(
    'publish-scheduled-posts',
    '* /5 * * * *',
    $$ SELECT net.http_post(
      url := 'https://{PROJECT_REF}.supabase.co/functions/v1/scheduled-publisher',
      headers := jsonb_build_object(
        'Authorization', 'Bearer {CRON_SECRET}',
        'Content-Type', 'application/json'
      )
    ) $$
  );
*/
