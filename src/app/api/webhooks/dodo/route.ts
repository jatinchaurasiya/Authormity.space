import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature, handleWebhookEvent, type DodoWebhookEvent } from '@/lib/dodo'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
    // Return 200 immediately to acknowledge receipt
    const rawBody = await req.text()
    const signature = req.headers.get('webhook-signature') || req.headers.get('x-webhook-signature') || ''

    // Verify signature
    if (!verifyWebhookSignature(rawBody, signature)) {
        console.error('DodoPayments webhook: invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    let event: DodoWebhookEvent
    try {
        event = JSON.parse(rawBody)
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // Process asynchronously
    processWebhookEvent(event).catch(console.error)

    return NextResponse.json({ received: true })
}

async function processWebhookEvent(event: DodoWebhookEvent) {
    const update = handleWebhookEvent(event)
    if (!update) return

    const supabase = createAdminClient()

    const updateData: Record<string, unknown> = {
        plan: update.plan,
        plan_status: update.planStatus,
        updated_at: new Date().toISOString(),
    }

    if (update.dodoCustomerId) {
        updateData.dodo_customer_id = update.dodoCustomerId
    }

    if (update.planExpiresAt) {
        updateData.plan_expires_at = update.planExpiresAt
    }

    // Reset posts limit when downgrading to free
    if (update.plan === 'free') {
        updateData.posts_used_this_month = 0
    }

    await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', update.userId)
}
