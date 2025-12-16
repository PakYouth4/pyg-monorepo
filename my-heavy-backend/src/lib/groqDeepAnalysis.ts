/**
 * groqDeepAnalysis.ts
 * Multi-stage deep analysis pipeline for comprehensive research reports
 * 
 * Stages:
 * 1. Key Facts Extraction
 * 2. Geopolitical Analysis
 * 3. Islamic Perspective
 * 4. Risk & Predictions
 * 5. Synthesis & Recommendations
 * + Citation Verification
 */

import { callGroqWithFallback, MODEL_CHAINS } from './groq';
import { CanonicalSource } from './groqNormalize';

// ============ OUTPUT INTERFACES ============

interface KeyFact {
    fact: string;
    source_ids: string[];
    verified: boolean;
}

interface KeyActor {
    name: string;
    role: string;
    motivations: string[];
}

interface GeopoliticalAnalysis {
    summary: string;
    key_actors: KeyActor[];
    power_dynamics: string;
    regional_implications: string;
    claims: Array<{ claim: string; source_ids: string[] }>;
}

interface IslamicPerspective {
    disclaimer: string;
    ethical_considerations: string[];
    relevant_principles: string[];
    community_impact: string;
}

interface RiskItem {
    risk: string;
    likelihood: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
}

interface Prediction {
    scenario: string;
    timeframe: string;
    probability: 'unlikely' | 'possible' | 'likely';
    basis: string;
}

interface Recommendation {
    action: string;
    target_audience: string;
    priority: 'low' | 'medium' | 'high';
}

interface HumanitarianImpact {
    affected_populations: string[];
    immediate_needs: string[];
    long_term_concerns: string[];
}

interface QualityMetrics {
    source_coverage: number;
    verified_claims: number;
    unverified_claims: number;
    confidence_grade: 'A' | 'B' | 'C' | 'D';
    needs_human_review: boolean;
}

export interface DeepAnalysis {
    topic: string;
    generated_at: string;
    key_facts: KeyFact[];
    geopolitical_analysis: GeopoliticalAnalysis;
    islamic_perspective: IslamicPerspective;
    risk_matrix: RiskItem[];
    predictions: Prediction[];
    recommendations: Recommendation[];
    humanitarian_impact: HumanitarianImpact;
    quality_metrics: QualityMetrics;
}

// ============ STAGE 1: KEY FACTS EXTRACTION ============
async function extractKeyFacts(
    topic: string,
    sources: CanonicalSource[]
): Promise<KeyFact[]> {
    console.log('[DeepAnalysis] Stage 1: Extracting key facts...');

    const sourceContext = sources.slice(0, 15).map(s =>
        `[${s.id}] ${s.title}: ${s.summary}`
    ).join('\n');

    const systemPrompt = `You are a fact extraction specialist. Identify verifiable factual claims from source material. Be precise and always cite sources. Output ONLY valid JSON arrays.`;

    const userPrompt = `<topic>${topic}</topic>

<sources>
${sourceContext}
</sources>

<task>
Extract 5-10 key factual claims from these sources.
</task>

<requirements>
- Each fact must be verifiable (dates, numbers, events, quotes)
- Cite source IDs that support each fact
- Prioritize most newsworthy/impactful facts
- Be specific, not vague
</requirements>

<schema>
[
  {"fact": "string", "source_ids": ["article_1", "video_2"]}
]
</schema>`;

    try {
        const response = await callGroqWithFallback({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            modelChain: MODEL_CHAINS.SUMMARIZE,
            temperature: 0.2,
            jsonMode: true
        });

        const parsed = JSON.parse(response);
        const facts: KeyFact[] = (Array.isArray(parsed) ? parsed : []).map((f: { fact?: string; source_ids?: string[] }) => ({
            fact: String(f.fact || ''),
            source_ids: Array.isArray(f.source_ids) ? f.source_ids : [],
            verified: false  // Will be verified in post-processing
        }));

        console.log(`[DeepAnalysis] Extracted ${facts.length} key facts`);
        return facts;

    } catch (error) {
        console.error('[DeepAnalysis] Stage 1 error:', error);
        return [];
    }
}

// ============ STAGE 2: GEOPOLITICAL ANALYSIS ============
async function analyzeGeopolitics(
    topic: string,
    sources: CanonicalSource[],
    facts: KeyFact[]
): Promise<GeopoliticalAnalysis> {
    console.log('[DeepAnalysis] Stage 2: Analyzing geopolitics...');

    const factsContext = facts.map(f => `- ${f.fact}`).join('\n');
    const sourceContext = sources.slice(0, 10).map(s =>
        `[${s.id}] ${s.title}`
    ).join('\n');

    const systemPrompt = `You are a geopolitical analyst specializing in conflict analysis. Think step-by-step about actors, motivations, and implications. Output ONLY valid JSON.`;

    const userPrompt = `<topic>${topic}</topic>

<facts>
${factsContext}
</facts>

<sources>
${sourceContext}
</sources>

<task>
Provide comprehensive geopolitical analysis.
</task>

<steps>
1. First, identify WHO the main actors are
2. Then, analyze WHAT each actor wants (motivations)
3. Next, examine the power balance between them
4. Finally, assess broader regional/global implications
</steps>

<avoid>
- Don't make unsupported claims without citing sources
- Don't oversimplify complex conflicts into good vs evil
- Don't ignore minor but influential actors
</avoid>

<example>
{
  "summary": "The conflict has escalated significantly since... Regional powers have responded by... The humanitarian situation continues to deteriorate...",
  "key_actors": [
    {"name": "Government Forces", "role": "State military", "motivations": ["Territorial control", "Regime survival"]},
    {"name": "Opposition Group", "role": "Armed resistance", "motivations": ["Political representation", "Regional autonomy"]}
  ],
  "power_dynamics": "Currently favors X due to Y...",
  "regional_implications": "Neighboring countries face refugee flows and potential spillover...",
  "claims": [{"claim": "Over 100 casualties reported", "source_ids": ["article_1", "video_2"]}]
}
</example>`;

    try {
        const response = await callGroqWithFallback({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            modelChain: MODEL_CHAINS.CLASSIFY,
            temperature: 0.3,
            jsonMode: true
        });

        const parsed = JSON.parse(response);
        return {
            summary: String(parsed.summary || ''),
            key_actors: Array.isArray(parsed.key_actors) ? parsed.key_actors : [],
            power_dynamics: String(parsed.power_dynamics || ''),
            regional_implications: String(parsed.regional_implications || ''),
            claims: Array.isArray(parsed.claims) ? parsed.claims : []
        };

    } catch (error) {
        console.error('[DeepAnalysis] Stage 2 error:', error);
        return {
            summary: '',
            key_actors: [],
            power_dynamics: '',
            regional_implications: '',
            claims: []
        };
    }
}

// ============ STAGE 3: ISLAMIC PERSPECTIVE ============
async function generateIslamicPerspective(
    topic: string,
    facts: KeyFact[],
    geopolitics: GeopoliticalAnalysis
): Promise<IslamicPerspective> {
    console.log('[DeepAnalysis] Stage 3: Generating Islamic perspective...');

    const context = `
Topic: ${topic}
Situation: ${geopolitics.summary}
Key Facts: ${facts.slice(0, 5).map(f => f.fact).join('; ')}
`;

    const systemPrompt = `You are a balanced Islamic studies scholar. Provide ethical perspectives based on universal Islamic principles (justice, mercy, sanctity of life). Always include a disclaimer. Be non-sectarian. Output ONLY valid JSON.`;

    const userPrompt = `<context>
${context}
</context>

<task>
Provide an Islamic ethical perspective on this situation.
</task>

<guidelines>
- This is ONE interpretation, not authoritative religious ruling
- Focus on: justice ('adl), mercy (rahma), protection of life
- Be balanced and respectful
- Avoid sectarian positions
</guidelines>

<schema>
{
  "disclaimer": "This represents one perspective based on general Islamic principles and should not be considered authoritative religious guidance.",
  "ethical_considerations": ["string", "string"],
  "relevant_principles": ["string", "string"],
  "community_impact": "string"
}
</schema>`;

    try {
        const response = await callGroqWithFallback({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            modelChain: MODEL_CHAINS.CLASSIFY,
            temperature: 0.4,
            jsonMode: true
        });

        const parsed = JSON.parse(response);
        return {
            disclaimer: String(parsed.disclaimer || 'This represents one perspective and should not be considered authoritative religious guidance.'),
            ethical_considerations: Array.isArray(parsed.ethical_considerations) ? parsed.ethical_considerations : [],
            relevant_principles: Array.isArray(parsed.relevant_principles) ? parsed.relevant_principles : [],
            community_impact: String(parsed.community_impact || '')
        };

    } catch (error) {
        console.error('[DeepAnalysis] Stage 3 error:', error);
        return {
            disclaimer: 'This represents one perspective and should not be considered authoritative religious guidance.',
            ethical_considerations: [],
            relevant_principles: [],
            community_impact: ''
        };
    }
}

// ============ STAGE 4: RISK & PREDICTIONS ============
async function assessRisksAndPredictions(
    topic: string,
    geopolitics: GeopoliticalAnalysis
): Promise<{ risks: RiskItem[]; predictions: Prediction[] }> {
    console.log('[DeepAnalysis] Stage 4: Assessing risks and predictions...');

    const systemPrompt = `You are a risk analyst and forecaster. Assess risks systematically and make evidence-based predictions. Think step-by-step. Output ONLY valid JSON.`;

    const userPrompt = `<topic>${topic}</topic>

<situation>
${geopolitics.summary}
</situation>

<actors>
${geopolitics.key_actors.map(a => `- ${a.name}: ${a.role}`).join('\n')}
</actors>

<task>
Generate risk assessment and predictions.
</task>

<requirements>
- 3-5 risks with likelihood, impact, and mitigation strategies
- 3-5 predictions with timeframe and probability
- Base predictions on current trajectory and actor motivations
</requirements>

<schema>
{
  "risks": [
    {"risk": "string", "likelihood": "low|medium|high", "impact": "low|medium|high", "mitigation": "string"}
  ],
  "predictions": [
    {"scenario": "string", "timeframe": "string", "probability": "unlikely|possible|likely", "basis": "string"}
  ]
}
</schema>`;

    try {
        const response = await callGroqWithFallback({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            modelChain: MODEL_CHAINS.CLASSIFY,
            temperature: 0.4,
            jsonMode: true
        });

        const parsed = JSON.parse(response);
        return {
            risks: Array.isArray(parsed.risks) ? parsed.risks : [],
            predictions: Array.isArray(parsed.predictions) ? parsed.predictions : []
        };

    } catch (error) {
        console.error('[DeepAnalysis] Stage 4 error:', error);
        return { risks: [], predictions: [] };
    }
}

// ============ STAGE 5: SYNTHESIS & RECOMMENDATIONS ============
async function synthesizeRecommendations(
    topic: string,
    facts: KeyFact[],
    geopolitics: GeopoliticalAnalysis,
    risks: RiskItem[]
): Promise<{ recommendations: Recommendation[]; humanitarian: HumanitarianImpact }> {
    console.log('[DeepAnalysis] Stage 5: Synthesizing recommendations...');

    const systemPrompt = `You are a policy advisor and humanitarian analyst. Generate actionable recommendations for different stakeholders. Focus on practical, implementable actions. Output ONLY valid JSON.`;

    const userPrompt = `<topic>${topic}</topic>

<findings>
${facts.slice(0, 5).map(f => `- ${f.fact}`).join('\n')}
</findings>

<risks>
${risks.map(r => `- ${r.risk} (${r.likelihood}/${r.impact})`).join('\n')}
</risks>

<task>
Generate recommendations and humanitarian impact assessment.
</task>

<target_audiences>
- Policymakers
- Activists/Advocates
- Community members
- Media/Journalists
</target_audiences>

<schema>
{
  "recommendations": [
    {"action": "specific action", "target_audience": "who", "priority": "low|medium|high"}
  ],
  "humanitarian": {
    "affected_populations": ["string"],
    "immediate_needs": ["string"],
    "long_term_concerns": ["string"]
  }
}
</schema>`;

    try {
        const response = await callGroqWithFallback({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            modelChain: MODEL_CHAINS.CLASSIFY,
            temperature: 0.3,
            jsonMode: true
        });

        const parsed = JSON.parse(response);
        return {
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            humanitarian: parsed.humanitarian || {
                affected_populations: [],
                immediate_needs: [],
                long_term_concerns: []
            }
        };

    } catch (error) {
        console.error('[DeepAnalysis] Stage 5 error:', error);
        return {
            recommendations: [],
            humanitarian: {
                affected_populations: [],
                immediate_needs: [],
                long_term_concerns: []
            }
        };
    }
}

// ============ CITATION VERIFICATION ============
function verifyCitations(
    facts: KeyFact[],
    geopolitics: GeopoliticalAnalysis,
    sources: CanonicalSource[]
): { verified: number; unverified: number; updatedFacts: KeyFact[] } {
    console.log('[DeepAnalysis] Verifying citations...');

    const sourceIds = new Set(sources.map(s => s.id));
    let verified = 0;
    let unverified = 0;

    // Verify facts
    const updatedFacts = facts.map(fact => {
        const validSources = fact.source_ids.filter(id => sourceIds.has(id));
        const isVerified = validSources.length > 0;

        if (isVerified) verified++;
        else unverified++;

        return {
            ...fact,
            source_ids: validSources,
            verified: isVerified
        };
    });

    // Verify geopolitical claims
    geopolitics.claims.forEach(claim => {
        const validSources = claim.source_ids.filter(id => sourceIds.has(id));
        if (validSources.length > 0) verified++;
        else unverified++;
    });

    console.log(`[DeepAnalysis] Verified: ${verified}, Unverified: ${unverified}`);
    return { verified, unverified, updatedFacts };
}

// ============ CALCULATE QUALITY METRICS ============
function calculateQualityMetrics(
    verified: number,
    unverified: number
): QualityMetrics {
    const total = verified + unverified;
    const coverage = total > 0 ? (verified / total) * 100 : 0;

    let grade: 'A' | 'B' | 'C' | 'D';
    if (coverage >= 90) grade = 'A';
    else if (coverage >= 70) grade = 'B';
    else if (coverage >= 50) grade = 'C';
    else grade = 'D';

    return {
        source_coverage: Math.round(coverage),
        verified_claims: verified,
        unverified_claims: unverified,
        confidence_grade: grade,
        needs_human_review: grade === 'D'
    };
}

// ============ MAIN ORCHESTRATOR ============
export async function runDeepAnalysis(
    topic: string,
    sources: CanonicalSource[]
): Promise<DeepAnalysis> {
    console.log(`[DeepAnalysis] Starting analysis for: "${topic}"`);
    console.log(`[DeepAnalysis] Using ${sources.length} sources`);

    // Stage 1: Extract key facts
    const keyFacts = await extractKeyFacts(topic, sources);

    // Stage 2: Geopolitical analysis
    const geopolitics = await analyzeGeopolitics(topic, sources, keyFacts);

    // Stage 3: Islamic perspective
    const islamicPerspective = await generateIslamicPerspective(topic, keyFacts, geopolitics);

    // Stage 4: Risks and predictions
    const { risks, predictions } = await assessRisksAndPredictions(topic, geopolitics);

    // Stage 5: Recommendations
    const { recommendations, humanitarian } = await synthesizeRecommendations(
        topic, keyFacts, geopolitics, risks
    );

    // Post-processing: Verify citations
    const { verified, unverified, updatedFacts } = verifyCitations(keyFacts, geopolitics, sources);

    // Calculate quality metrics
    const qualityMetrics = calculateQualityMetrics(verified, unverified);

    console.log(`[DeepAnalysis] Complete. Grade: ${qualityMetrics.confidence_grade}`);

    return {
        topic,
        generated_at: new Date().toISOString(),
        key_facts: updatedFacts,
        geopolitical_analysis: geopolitics,
        islamic_perspective: islamicPerspective,
        risk_matrix: risks,
        predictions,
        recommendations,
        humanitarian_impact: humanitarian,
        quality_metrics: qualityMetrics
    };
}
