import type { VoiceProfile } from '@/types'

// ─── Global System Prompt ──────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are an expert LinkedIn ghostwriter and personal branding strategist with 10+ years of experience helping professionals build audiences of 50,000+ followers.

Your writing rules — follow EVERY time:
1. Never use: 'delve', 'leverage', 'synergy', 'game-changer', 'In today's world', 'Let's dive in', 'It's important to note', 'I hope this finds you well'
2. Write like a confident human expert, not an AI assistant
3. Hooks must stop the scroll in under 12 words
4. Use white space. Short paragraphs. 1-3 sentences each.
5. CTA must be specific, not 'What do you think?'
6. When asked for JSON: return ONLY valid JSON. No markdown. No explanation.`

// ─── Voice Context Builder ────────────────────────────────────────────────────

export function buildVoiceContext(voice: VoiceProfile): string {
    return `
WRITER'S VOICE PROFILE — MATCH THIS EXACTLY:
Tone: ${voice.tone}
Sentence length: ${voice.sentence_length}
Emoji usage: ${voice.emoji_usage}
Hook style: ${voice.hook_style}
Characteristic words: ${voice.vocabulary.join(', ')}
NEVER use: ${voice.avoids.join(', ')}
Voice description: ${voice.signature}
`.trim()
}

// ─── Prompt Templates ─────────────────────────────────────────────────────────

const LENGTH_WORDS: Record<string, string> = {
    short: '100-150 words',
    medium: '150-250 words',
    long: '250-350 words',
}

export const PROMPTS = {
    post: (
        topic: string,
        tone: string,
        length: string,
        voiceContext?: string
    ) => `${voiceContext ? voiceContext + '\n\n' : ''}Write a LinkedIn post about: "${topic}"

Tone: ${tone}
Length: ${LENGTH_WORDS[length] || '150-250 words'}

Structure:
- Hook (MUST be under 12 words. Must stop the scroll.)
- Body (short paragraphs, 1-3 sentences each. Add value. Be specific.)
- CTA (specific question or call to action — not generic)

No hashtags unless the topic demands it. No buzzwords. No filler.
Start directly with the hook. Do not label sections.`,

    hooks: (topic: string, voiceContext?: string) =>
        `${voiceContext ? voiceContext + '\n\n' : ''}Generate 7 LinkedIn hooks for the topic: "${topic}"

One hook per style. Each hook MUST be under 12 words.

Styles (in this order):
1. Bold claim
2. Story opener
3. Surprising statistic
4. Provocative question
5. Numbered promise ("X things/ways/reasons...")
6. Relatable frustration
7. Consequence ("If you X, you will Y")

Format: number, style label in brackets, then the hook.
Example: 1. [Bold Claim] Most LinkedIn advice is wrong.`,

    ideas: (niche: string, voiceContext?: string) =>
        `${voiceContext ? voiceContext + '\n\n' : ''}Generate 15 specific LinkedIn post ideas for a ${niche} creator.

Distribution (must follow this exactly):
- 3 personal stories
- 3 hot takes / contrarian opinions
- 2 how-to / tutorial posts
- 2 listicle posts
- 2 failure / lesson posts
- 2 trend commentary posts
- 1 poll post

Format each idea as:
[number]. [Type]: [Specific, hook-ready title]

Be SPECIFIC. Not "5 lessons from my career" but "5 things I wish I knew before my first VP job at 28."`,

    repurpose: (sourceType: string, sourceContent: string, voiceContext?: string) =>
        `${voiceContext ? voiceContext + '\n\n' : ''}Repurpose this ${sourceType} into a LinkedIn post:

---
${sourceContent}
---

Instructions:
1. Extract the single most valuable insight
2. Rewrite it for a LinkedIn professional audience
3. Use: Hook → Body (short paragraphs) → Specific CTA
4. Make it feel original, not summarized
5. Hook under 12 words

Return only the post. No explanation.`,

    rateHook: (hook: string) =>
        `Rate this LinkedIn hook and return ONLY valid JSON (no markdown, no explanation):
"${hook}"

JSON format:
{
  "overallScore": 7,
  "scrollStopping": 8,
  "curiosityGap": 6,
  "clarity": 9,
  "specificity": 5,
  "verdict": "Strong but too vague",
  "improvement": "The improved hook text here",
  "reason": "One sentence explaining what to improve"
}

All scores: 1-10. overallScore is weighted average of the four dimensions.`,

    analyzeVoice: (samplePosts: string[]) =>
        `Analyze these LinkedIn posts and extract the writer's unique voice.
Return ONLY valid JSON (no markdown, no explanation):

POSTS:
${samplePosts.map((p, i) => `--- POST ${i + 1} ---\n${p}`).join('\n\n')}

JSON format:
{
  "tone": "conversational",
  "sentence_length": "short",
  "emoji_usage": "occasional",
  "hook_style": "question",
  "vocabulary": ["authentic", "real talk", "truth"],
  "avoids": ["leverage", "synergy", "circle back"],
  "personality_traits": ["direct", "empathetic", "data-driven"],
  "signature": "2-3 sentence description of their unique voice and writing style"
}

tone options: conversational / professional / motivational / analytical / direct
sentence_length options: short / medium / long / mixed
emoji_usage options: none / occasional / frequent
hook_style options: question / bold-statement / story / statistic / list-promise`,

    comment: (postText: string, intent: string, voiceContext?: string) =>
        `${voiceContext ? voiceContext + '\n\n' : ''}Generate 3 LinkedIn comment options for this post:

POST:
"${postText}"

Intent: ${intent}

Rules:
- 2-4 sentences each
- Specific to the post content (reference actual points)
- Human and genuine, not generic
- Adds value or perspective, doesn't just compliment
- Different angles for each option

Label them: Option 1, Option 2, Option 3`,

    humanize: (aiText: string, voiceContext?: string) =>
        `${voiceContext ? voiceContext + '\n\n' : ''}Rewrite this AI-generated LinkedIn post to sound like a real human wrote it:

ORIGINAL:
${aiText}

Rules:
- Remove: robotic sentence patterns, hollow filler, corporate buzzwords
- Vary sentence length (mix short punchy lines with longer ones)
- Add specificity where it's vague
- Keep the core message and structure
- Make it conversational and confident

Return only the rewritten post.`,

    carousel: (topic: string, slideCount: number, voiceContext?: string) =>
        `${voiceContext ? voiceContext + '\n\n' : ''}Create a LinkedIn carousel outline for:
Topic: "${topic}"
Slides: ${slideCount}

Format:
SLIDE 1 (Cover): [Compelling title that makes people swipe]
SLIDE 2: [Headline] + [Bullet 1, max 10 words] + [Bullet 2, max 10 words]
...continue for all slides...
SLIDE ${slideCount} (CTA): [What action to take + why]

Rules:
- One idea per slide. No cramming.
- Headlines are punchy (under 8 words)
- Each slide should work as a standalone insight`,

    thread: (topic: string, threadCount: number, voiceContext?: string) =>
        `${voiceContext ? voiceContext + '\n\n' : ''}Write a LinkedIn thread about: "${topic}"
${threadCount} posts total.

Format:
POST 1 (Hook): Hook (under 12 words) + premise of the thread (2-3 sentences). End with "Thread 🧵"
POST 2-${threadCount - 1}: One specific point each. Short. Standalone. Number them (2/${threadCount}, 3/${threadCount}...)
POST ${threadCount} (CTA): Summary of the key takeaway + specific call to action

Rules:
- Each post must work standalone
- No filler or repetition
- Specific examples over generic advice`,

    connectionMessage: (personRole: string, context: string, userNiche: string) =>
        `Write a LinkedIn connection request message.

Sender's niche: ${userNiche}
Recipient's role: ${personRole}
Context / reason for connecting: ${context}

Rules:
- STRICT 300 character limit (count carefully)
- Personalized and specific
- No cringe ("I'd love to connect and learn from you!")
- Mention something specific to their role or context
- Natural, human tone

Return ONLY the message text. No explanation. No labels.`,

    weeklyInsights: (analyticsData: string) =>
        `Based on this LinkedIn analytics data from the last 30 days, generate 3-5 specific, actionable insights:

${analyticsData}

Rules:
- Be specific with the data (mention actual numbers)
- Identify patterns (what topics, days, lengths performed best)
- Tell them what to stop doing
- Give one specific action to take next week

Format as plain text paragraphs. No bullet points. Conversational tone.`,
}
