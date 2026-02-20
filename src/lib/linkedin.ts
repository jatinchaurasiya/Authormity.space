import CryptoJS from 'crypto-js'
import type { LinkedInTokenResponse, LinkedInUserInfo } from '@/types'

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2'
const LINKEDIN_OIDC_BASE = 'https://www.linkedin.com/oauth/v2'

// ─── Token Encryption ─────────────────────────────────────────────────────────

export function encryptToken(token: string): string {
    return CryptoJS.AES.encrypt(token, process.env.TOKEN_ENCRYPTION_KEY!).toString()
}

export function decryptToken(encrypted: string): string {
    const bytes = CryptoJS.AES.decrypt(encrypted, process.env.TOKEN_ENCRYPTION_KEY!)
    return bytes.toString(CryptoJS.enc.Utf8)
}

// ─── OAuth Helpers ────────────────────────────────────────────────────────────

export function buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
        state,
        scope: 'openid profile email w_member_social',
    })
    return `${LINKEDIN_OIDC_BASE}/authorization?${params.toString()}`
}

export async function exchangeCodeForTokens(
    code: string
): Promise<LinkedInTokenResponse> {
    const response = await fetch(`${LINKEDIN_OIDC_BASE}/accessToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
            client_id: process.env.LINKEDIN_CLIENT_ID!,
            client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        }),
    })

    if (!response.ok) {
        throw new Error(`LinkedIn token exchange failed: ${await response.text()}`)
    }

    return response.json()
}

export async function refreshLinkedInToken(
    refreshToken: string
): Promise<LinkedInTokenResponse> {
    const response = await fetch(`${LINKEDIN_OIDC_BASE}/accessToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: process.env.LINKEDIN_CLIENT_ID!,
            client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        }),
    })

    if (!response.ok) {
        throw new Error(`LinkedIn token refresh failed: ${await response.text()}`)
    }

    return response.json()
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function getLinkedInUserInfo(
    accessToken: string
): Promise<LinkedInUserInfo> {
    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
        throw new Error(`LinkedIn userinfo failed: ${await response.text()}`)
    }

    return response.json()
}

// ─── Post Publishing ──────────────────────────────────────────────────────────

export async function publishTextPost(
    accessToken: string,
    personId: string,
    content: string
): Promise<string> {
    const response = await fetch(`${LINKEDIN_API_BASE}/ugcPosts`, {
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

    if (!response.ok) {
        throw new Error(`LinkedIn publish failed: ${await response.text()}`)
    }

    const data = await response.json()
    return data.id // URN of the created post
}

export async function publishImagePost(
    accessToken: string,
    personId: string,
    content: string,
    imageBuffer: Uint8Array,
    imageType: string = 'image/jpeg'
): Promise<string> {
    // Step 1: Register upload
    const registerResponse = await fetch(`${LINKEDIN_API_BASE}/assets?action=registerUpload`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            registerUploadRequest: {
                owner: `urn:li:person:${personId}`,
                recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                serviceRelationships: [
                    {
                        identifier: 'urn:li:userGeneratedContent',
                        relationshipType: 'OWNER',
                    },
                ],
            },
        }),
    })

    if (!registerResponse.ok) {
        throw new Error(`Image register failed: ${await registerResponse.text()}`)
    }

    const registerData = await registerResponse.json()
    const uploadUrl =
        registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']
            .uploadUrl
    const assetUrn: string = registerData.value.asset

    // Step 2: Upload binary
    const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': imageType,
        },
        body: imageBuffer as BodyInit,
    })

    if (!uploadResponse.ok) {
        throw new Error(`Image upload failed: ${await uploadResponse.text()}`)
    }

    // Step 3: Create post with image
    const postResponse = await fetch(`${LINKEDIN_API_BASE}/ugcPosts`, {
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
                    shareMediaCategory: 'IMAGE',
                    media: [
                        {
                            status: 'READY',
                            description: { text: '' },
                            media: assetUrn,
                            title: { text: '' },
                        },
                    ],
                },
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
            },
        }),
    })

    if (!postResponse.ok) {
        throw new Error(`LinkedIn image post failed: ${await postResponse.text()}`)
    }

    const postData = await postResponse.json()
    return postData.id
}

export async function deleteLinkedInPost(
    accessToken: string,
    postId: string
): Promise<void> {
    const response = await fetch(`${LINKEDIN_API_BASE}/ugcPosts/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
        throw new Error(`LinkedIn delete failed: ${await response.text()}`)
    }
}
