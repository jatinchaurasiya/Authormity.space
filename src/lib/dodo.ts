import type { Plan } from '@/types'
import { createHmac } from 'crypto'

// ─── Plan Definitions ─────────────────────────────────────────────────────────

export const DODO_PLANS: Record<string, { name: string; plan: Plan; price: string }> = {
    pro_monthly: { name: 'Pro Monthly', plan: 'pro', price: '$19/mo' },
    pro_annual: { name: 'Pro Annual', plan: 'pro', price: '$159/yr' },
    team_monthly: { name: 'Team Monthly', plan: 'team', price: '$49/mo' },
}

const PLAN_PAYMENT_LINKS: Record<'pro_monthly' | 'pro_annual' | 'team_monthly', string> = {
    pro_monthly: process.env.DODO_PRO_MONTHLY_LINK || '',
    pro_annual: process.env.DODO_PRO_ANNUAL_LINK || '',
    team_monthly: process.env.DODO_TEAM_LINK || '',
}

// ─── Checkout URL Builder ─────────────────────────────────────────────────────

export function getCheckoutUrl(
    planKey: 'pro_monthly' | 'pro_annual' | 'team_monthly',
    userId: string,
    email: string
): string {
    const baseUrl = PLAN_PAYMENT_LINKS[planKey]
    if (!baseUrl) throw new Error(`No payment link configured for plan: ${planKey}`)

    const params = new URLSearchParams({
        prefilled_email: email,
        metadata_user_id: userId,
        metadata_plan: planKey,
    })

    return `${baseUrl}?${params.toString()}`
}

// ─── Webhook Signature Verification ──────────────────────────────────────────

export function verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string = process.env.DODO_WEBHOOK_SECRET!
): boolean {
    try {
        const expectedSignature = createHmac('sha256', secret)
            .update(payload)
            .digest('hex')

        // Constant time comparison
        const expected = Buffer.from(expectedSignature, 'hex')
        const received = Buffer.from(signature.replace('sha256=', ''), 'hex')

        if (expected.length !== received.length) return false

        return expected.equals(received)
    } catch {
        return false
    }
}

// ─── Webhook Event Handler ────────────────────────────────────────────────────

export type DodoEventType =
    | 'payment.succeeded'
    | 'subscription.active'
    | 'subscription.cancelled'
    | 'subscription.expired'

export interface DodoWebhookEvent {
    type: DodoEventType
    data: {
        customer_id?: string
        metadata?: {
            user_id?: string
            plan?: string
        }
        subscription?: {
            id: string
            status: string
            current_period_end?: string
        }
    }
}

export interface WebhookUpdatePayload {
    userId: string
    plan: Plan
    planStatus: 'active' | 'cancelled' | 'expired'
    planExpiresAt?: string
    dodoCustomerId?: string
}

export function handleWebhookEvent(event: DodoWebhookEvent): WebhookUpdatePayload | null {
    const userId = event.data.metadata?.user_id
    const planKey = event.data.metadata?.plan as keyof typeof DODO_PLANS | undefined

    if (!userId) return null

    switch (event.type) {
        case 'payment.succeeded':
        case 'subscription.active':
            return {
                userId,
                plan: planKey ? DODO_PLANS[planKey]?.plan ?? 'pro' : 'pro',
                planStatus: 'active',
                dodoCustomerId: event.data.customer_id,
                planExpiresAt: event.data.subscription?.current_period_end,
            }

        case 'subscription.cancelled':
        case 'subscription.expired':
            return {
                userId,
                plan: 'free',
                planStatus: event.type === 'subscription.cancelled' ? 'cancelled' : 'expired',
            }

        default:
            return null
    }
}
