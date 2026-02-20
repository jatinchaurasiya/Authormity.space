const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

interface AICallOptions {
    prompt: string
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
    model?: string
}

interface OpenRouterMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

interface OpenRouterResponse {
    id: string
    choices: {
        message: {
            role: string
            content: string
        }
        finish_reason: string
    }[]
    usage: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
    }
}

/**
 * Core AI call function routing through OpenRouter.
 * Model is configured via OPENROUTER_MODEL env variable.
 * Retries once on 500 errors.
 */
export async function callAI(options: AICallOptions): Promise<string> {
    const {
        prompt,
        systemPrompt,
        temperature = 0.8,
        maxTokens = 1000,
        model = process.env.OPENROUTER_MODEL || 'arcee-ai/trinity-large-preview:free',
    } = options

    const messages: OpenRouterMessage[] = []

    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt })
    }

    messages.push({ role: 'user', content: prompt })

    const makeRequest = async (): Promise<Response> => {
        return fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://authormity.com',
                'X-Title': 'Authormity',
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens: maxTokens,
            }),
        })
    }

    let response = await makeRequest()

    // Retry once on server errors
    if (response.status >= 500) {
        await new Promise((r) => setTimeout(r, 1000))
        response = await makeRequest()
    }

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenRouter API error ${response.status}: ${errorText}`)
    }

    const data: OpenRouterResponse = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
        throw new Error('No content returned from AI')
    }

    return content.trim()
}

/**
 * Parse AI JSON response safely.
 * Strips markdown code fences if present.
 */
export function parseAIJson<T>(content: string): T {
    // Strip markdown code fences
    const cleaned = content
        .replace(/^```json\n?/, '')
        .replace(/^```\n?/, '')
        .replace(/\n?```$/, '')
        .trim()

    return JSON.parse(cleaned) as T
}
