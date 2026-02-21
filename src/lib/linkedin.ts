const LINKEDIN_OIDC_BASE = 'https://www.linkedin.com/oauth/v2'
const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2'

export interface LinkedInTokens {
    accessToken: string
    refreshToken: string
    expiresIn: number
}

export interface LinkedInProfile {
    id: string
    name: string
    email: string
    avatar: string
}

interface LinkedInTokenResponse {
    access_token: string
    refresh_token: string
    expires_in: number
    token_type: string
}

interface LinkedInUserInfoResponse {
    sub: string
    name: string
    given_name: string
    family_name: string
    email: string
    picture?: string
    locale?: string
}

async function fetchOrThrow(url: string, init: RequestInit, label: string): Promise<Response> {
    const res = await fetch(url, init)
    if (!res.ok) {
        const body = await res.text().catch(() => '(unreadable body)')
        throw new Error(`LinkedIn ${label} failed [${res.status}]: ${body}`)
    }
    return res
}

/**
 * Exchanges an authorization code for LinkedIn OAuth tokens.
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

    const data: LinkedInTokenResponse = await res.json()
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
    }
}

/**
 * Fetches the authenticated user's LinkedIn profile via OIDC userinfo endpoint.
 */
export async function getLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
    const res = await fetchOrThrow(
        `${LINKEDIN_API_BASE}/userinfo`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        'userinfo'
    )

    const data: LinkedInUserInfoResponse = await res.json()
    return {
        id: data.sub,
        name: data.name ?? `${data.given_name} ${data.family_name}`.trim(),
        email: data.email,
        avatar: data.picture ?? '',
    }
}

/**
 * Refreshes an expired LinkedIn access token using a refresh token.
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

    const data: LinkedInTokenResponse = await res.json()
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
    }
}

/**
 * Publishes a text post to LinkedIn.
 * Returns the LinkedIn post URN.
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
 * Deletes a LinkedIn post by URN.
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
