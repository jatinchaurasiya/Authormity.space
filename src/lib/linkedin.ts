const LINKEDIN_OIDC_BASE = 'https://www.linkedin.com/oauth/v2'
const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2'

// ─── Response shapes (LinkedIn API) ──────────────────────────────────────────

interface LinkedInRawTokenResponse {
    access_token: string
    refresh_token: string
    expires_in: number
    token_type: string
}

// ─── Public-facing types ──────────────────────────────────────────────────────

export interface LinkedInTokens {
    access_token: string
    refresh_token: string
    expires_in: number
}

export interface LinkedInProfile {
    id: string
    name: string
    email: string
    avatar: string
}

interface LinkedInUserInfoResponse {
    sub: string
    name: string
    given_name: string
    family_name: string
    email: string
    picture?: string
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function fetchOrThrow(url: string, init: RequestInit, label: string): Promise<Response> {
    const res = await fetch(url, init)
    if (!res.ok) {
        const body = await res.text().catch(() => '(unreadable body)')
        throw new Error(`LinkedIn ${label} failed [${res.status}]: ${body}`)
    }
    return res
}

// ─── Token exchange ───────────────────────────────────────────────────────────

/**
 * Exchange an authorization code for LinkedIn OAuth tokens.
 * Returns snake_case keys exactly as LinkedIn provides them.
 */
export async function exchangeCodeForToken(code: string): Promise<LinkedInTokens> {
    const res = await fetchOrThrow(
        `${LINKEDIN_OIDC_BASE}/accessToken`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
                client_id: process.env.LINKEDIN_CLIENT_ID!,
                client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
            }),
        },
        'token exchange'
    )

    const data = (await res.json()) as LinkedInRawTokenResponse

    if (!data?.access_token) {
        throw new Error('LinkedIn token exchange failed: access_token missing in response')
    }

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? '',
        expires_in: data.expires_in ?? 3600,
    }
}

// ─── Profile fetch ────────────────────────────────────────────────────────────

/**
 * Fetch the authenticated user's LinkedIn profile via OIDC userinfo endpoint.
 */
export async function getLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
    const res = await fetchOrThrow(
        `${LINKEDIN_API_BASE}/userinfo`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        'userinfo'
    )

    const data = (await res.json()) as LinkedInUserInfoResponse
    return {
        id: data.sub,
        name: data.name ?? `${data.given_name ?? ''} ${data.family_name ?? ''}`.trim(),
        email: data.email,
        avatar: data.picture ?? '',
    }
}

// ─── Token refresh ────────────────────────────────────────────────────────────

/**
 * Refresh an expired LinkedIn access token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<LinkedInTokens> {
    const res = await fetchOrThrow(
        `${LINKEDIN_OIDC_BASE}/accessToken`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: process.env.LINKEDIN_CLIENT_ID!,
                client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
            }),
        },
        'token refresh'
    )

    const data = (await res.json()) as LinkedInRawTokenResponse

    if (!data?.access_token) {
        throw new Error('LinkedIn token refresh failed: access_token missing in response')
    }

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? '',
        expires_in: data.expires_in ?? 3600,
    }
}

// ─── Post publishing ──────────────────────────────────────────────────────────

/**
 * Publish a text post to LinkedIn. Returns the post URN.
 */
export async function publishTextPost(
    accessToken: string,
    personId: string,
    content: string
): Promise<string> {
    const res = await fetchOrThrow(
        `${LINKEDIN_API_BASE}/ugcPosts`,
        {
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
        },
        'publish post'
    )

    const data = (await res.json()) as { id: string }
    return data.id
}

/**
 * Delete a LinkedIn post by URN.
 */
export async function deleteLinkedInPost(
    accessToken: string,
    postUrn: string
): Promise<void> {
    await fetchOrThrow(
        `${LINKEDIN_API_BASE}/ugcPosts/${encodeURIComponent(postUrn)}`,
        {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0',
            },
        },
        'delete post'
    )
}
