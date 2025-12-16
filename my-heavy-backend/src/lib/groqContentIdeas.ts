/**
 * groqContentIdeas.ts
 * Transforms deep analysis into platform-ready content ideas
 * Target audience: Teen to pre-adult (15-25)
 */

import { callGroqWithFallback, MODEL_CHAINS } from './groq';
import { DeepAnalysis } from './groqDeepAnalysis';

// ============ OUTPUT INTERFACES ============

export interface ContentIdea {
    id: string;
    platform: 'instagram_reel' | 'tiktok' | 'twitter_thread' | 'carousel' | 'youtube_short';
    hook: string;                    // <=10 words, attention-grabbing
    script: string;                  // 15-30s spoken content
    key_message: string;             // Core takeaway
    visual_style: string;            // Suggested visual approach
    sensitivity_level: 'standard' | 'cautious' | 'sensitive';
    ethical_notes: string[];         // Things to be careful about
    source_reference: string;        // Which fact/claim this is based on
    priority: number;                // 1-5, 1 = highest priority
    call_to_action: string;
    hashtags: string[];
}

export interface ContentIdeasResult {
    topic: string;
    generated_at: string;
    target_audience: string;
    content_ideas: ContentIdea[];
    stats: {
        total_ideas: number;
        by_platform: Record<string, number>;
        high_priority_count: number;
    };
}

// ============ PLATFORM-SPECIFIC GENERATORS ============

async function generateReelIdeas(
    topic: string,
    analysis: DeepAnalysis
): Promise<ContentIdea[]> {
    console.log('[ContentIdeas] Generating Instagram/TikTok Reel ideas...');

    const keyFacts = analysis.key_facts.slice(0, 5).map(f => f.fact).join('\n- ');
    const keyActors = analysis.geopolitical_analysis.key_actors.slice(0, 3)
        .map(a => `${a.name}: ${a.role}`).join('\n- ');

    const systemPrompt = `You are a viral content strategist for youth activism. Create engaging, educational content for Instagram/TikTok. Be punchy, authentic, and impactful. Output ONLY valid JSON arrays.`;

    const userPrompt = `<topic>${topic}</topic>

<facts>
- ${keyFacts}
</facts>

<actors>
- ${keyActors}
</actors>

<audience>Youth (15-25), socially conscious, Instagram/TikTok users</audience>

<task>
Generate 3-4 Instagram Reel ideas.
</task>

<requirements>
- hook: MAX 10 words ("POV:", "Wait...", "Nobody's talking about...")
- script: 15-30 second spoken script (conversational, punchy)
- sensitivity_level: "standard" | "cautious" (violence) | "sensitive" (religious)
- Include ethical_notes for cautious/sensitive content
- Base each idea on a specific fact
</requirements>

<schema>
[{
  "id": "reel_1",
  "platform": "instagram_reel",
  "hook": "string (<=10 words)",
  "script": "string (15-30s)",
  "key_message": "string",
  "visual_style": "string",
  "sensitivity_level": "standard|cautious|sensitive",
  "ethical_notes": ["string"],
  "source_reference": "string",
  "priority": 1-5,
  "call_to_action": "string",
  "hashtags": ["string"]
}]
</schema>`;

    try {
        const response = await callGroqWithFallback({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            modelChain: MODEL_CHAINS.SUMMARIZE,
            temperature: 0.6,
            jsonMode: true
        });

        const parsed = JSON.parse(response);
        return (Array.isArray(parsed) ? parsed : []).map((idea: Record<string, unknown>, idx: number) => ({
            id: String(idea.id || `reel_${idx + 1}`),
            platform: 'instagram_reel' as const,
            hook: String(idea.hook || ''),
            script: String(idea.script || ''),
            key_message: String(idea.key_message || ''),
            visual_style: String(idea.visual_style || ''),
            sensitivity_level: (idea.sensitivity_level as ContentIdea['sensitivity_level']) || 'standard',
            ethical_notes: Array.isArray(idea.ethical_notes) ? idea.ethical_notes.map(String) : [],
            source_reference: String(idea.source_reference || ''),
            priority: Number(idea.priority) || 3,
            call_to_action: String(idea.call_to_action || ''),
            hashtags: Array.isArray(idea.hashtags) ? idea.hashtags.map(String) : []
        }));

    } catch (error) {
        console.error('[ContentIdeas] Reel generation error:', error);
        return [];
    }
}

async function generateCarouselIdeas(
    topic: string,
    analysis: DeepAnalysis
): Promise<ContentIdea[]> {
    console.log('[ContentIdeas] Generating carousel ideas...');

    const predictions = analysis.predictions.slice(0, 3)
        .map(p => `${p.scenario} (${p.probability})`).join('\n- ');
    const riskItems = analysis.risk_matrix.slice(0, 3)
        .map(r => `${r.risk} - ${r.likelihood} likelihood`).join('\n- ');

    const prompt = `
TOPIC: "${topic}"

KEY INSIGHTS:
${analysis.geopolitical_analysis.summary}

PREDICTIONS:
- ${predictions}

RISKS:
- ${riskItems}

AUDIENCE: Youth (15-25 years), prefer visual learning, scroll through Instagram/LinkedIn

TASK: Generate 2-3 Instagram Carousel ideas (educational, swipe-through format).

Each carousel should:
- Have a hook that makes people stop scrolling
- Be 5-8 slides worth of content (summarize what each slide covers)
- End with a strong call to action
- Be shareable and educational

OUTPUT: JSON array matching the content idea structure.
Include: id, platform (set to "carousel"), hook, script (describe slide content), key_message, visual_style, sensitivity_level, ethical_notes, source_reference, priority, call_to_action, hashtags.`;

    try {
        const response = await callGroqWithFallback({
            messages: [{ role: "user", content: prompt }],
            modelChain: MODEL_CHAINS.SUMMARIZE,
            temperature: 0.6,
            jsonMode: true
        });

        const parsed = JSON.parse(response);
        return (Array.isArray(parsed) ? parsed : []).map((idea: Record<string, unknown>, idx: number) => ({
            id: String(idea.id || `carousel_${idx + 1}`),
            platform: 'carousel' as const,
            hook: String(idea.hook || ''),
            script: String(idea.script || ''),
            key_message: String(idea.key_message || ''),
            visual_style: String(idea.visual_style || ''),
            sensitivity_level: (idea.sensitivity_level as ContentIdea['sensitivity_level']) || 'standard',
            ethical_notes: Array.isArray(idea.ethical_notes) ? idea.ethical_notes.map(String) : [],
            source_reference: String(idea.source_reference || ''),
            priority: Number(idea.priority) || 3,
            call_to_action: String(idea.call_to_action || ''),
            hashtags: Array.isArray(idea.hashtags) ? idea.hashtags.map(String) : []
        }));

    } catch (error) {
        console.error('[ContentIdeas] Carousel generation error:', error);
        return [];
    }
}

async function generateTwitterThread(
    topic: string,
    analysis: DeepAnalysis
): Promise<ContentIdea[]> {
    console.log('[ContentIdeas] Generating Twitter thread ideas...');

    const islamicPerspective = analysis.islamic_perspective.ethical_considerations.join(', ');
    const recommendations = analysis.recommendations.slice(0, 3)
        .map(r => `${r.action} (${r.target_audience})`).join('\n- ');

    const prompt = `
TOPIC: "${topic}"

GEOPOLITICAL SUMMARY:
${analysis.geopolitical_analysis.summary}

ISLAMIC PERSPECTIVE:
${islamicPerspective}

RECOMMENDATIONS:
- ${recommendations}

AUDIENCE: Youth (15-25 years), Twitter/X users, appreciate nuanced takes

TASK: Generate 1-2 Twitter/X thread ideas.

Each thread should:
- Have a killer first tweet (hook)
- Be 5-10 tweets long (outline the thread flow in script)
- Include a perspective that isn't mainstream
- End with discussion question or call to action

OUTPUT: JSON array matching content idea structure.
Platform should be "twitter_thread".`;

    try {
        const response = await callGroqWithFallback({
            messages: [{ role: "user", content: prompt }],
            modelChain: MODEL_CHAINS.SUMMARIZE,
            temperature: 0.6,
            jsonMode: true
        });

        const parsed = JSON.parse(response);
        return (Array.isArray(parsed) ? parsed : []).map((idea: Record<string, unknown>, idx: number) => ({
            id: String(idea.id || `thread_${idx + 1}`),
            platform: 'twitter_thread' as const,
            hook: String(idea.hook || ''),
            script: String(idea.script || ''),
            key_message: String(idea.key_message || ''),
            visual_style: String(idea.visual_style || ''),
            sensitivity_level: (idea.sensitivity_level as ContentIdea['sensitivity_level']) || 'standard',
            ethical_notes: Array.isArray(idea.ethical_notes) ? idea.ethical_notes.map(String) : [],
            source_reference: String(idea.source_reference || ''),
            priority: Number(idea.priority) || 3,
            call_to_action: String(idea.call_to_action || ''),
            hashtags: Array.isArray(idea.hashtags) ? idea.hashtags.map(String) : []
        }));

    } catch (error) {
        console.error('[ContentIdeas] Thread generation error:', error);
        return [];
    }
}

// ============ MAIN GENERATOR ============

export async function generateContentIdeas(
    analysis: DeepAnalysis
): Promise<ContentIdeasResult> {
    console.log(`[ContentIdeas] Generating content ideas for: "${analysis.topic}"`);

    // Generate Instagram content types in parallel (Reels + Carousels only)
    const [reelIdeas, carouselIdeas] = await Promise.all([
        generateReelIdeas(analysis.topic, analysis),
        generateCarouselIdeas(analysis.topic, analysis)
    ]);

    // Combine all ideas
    const allIdeas = [...reelIdeas, ...carouselIdeas];

    // Sort by priority
    allIdeas.sort((a, b) => a.priority - b.priority);

    // Calculate stats
    const byPlatform: Record<string, number> = {};
    allIdeas.forEach(idea => {
        byPlatform[idea.platform] = (byPlatform[idea.platform] || 0) + 1;
    });

    const highPriorityCount = allIdeas.filter(i => i.priority <= 2).length;

    console.log(`[ContentIdeas] Generated ${allIdeas.length} content ideas`);

    return {
        topic: analysis.topic,
        generated_at: new Date().toISOString(),
        target_audience: 'Youth (15-25 years)',
        content_ideas: allIdeas,
        stats: {
            total_ideas: allIdeas.length,
            by_platform: byPlatform,
            high_priority_count: highPriorityCount
        }
    };
}
