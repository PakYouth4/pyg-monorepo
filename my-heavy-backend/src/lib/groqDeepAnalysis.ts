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

    const prompt = `
TOPIC: "${topic}"

SOURCES:
${sourceContext}

TASK: Extract the most important factual claims from these sources.

For each fact:
- State the fact clearly
- List which source IDs support it (e.g., ["article_1", "video_2"])

OUTPUT: JSON array of objects with "fact" and "source_ids" fields.
Return 5-10 key facts.

Example:
[
  {"fact": "Over 100 casualties reported in the conflict", "source_ids": ["article_1", "article_3"]},
  {"fact": "UN Security Council called emergency meeting", "source_ids": ["article_2"]}
]`;

    try {
        const response = await callGroqWithFallback({
            messages: [{ role: "user", content: prompt }],
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

    const prompt = `
TOPIC: "${topic}"

KEY FACTS:
${factsContext}

AVAILABLE SOURCES:
${sourceContext}

TASK: Provide geopolitical analysis including:
1. Summary of the situation (2-3 paragraphs)
2. Key actors involved (name, role, motivations)
3. Power dynamics at play
4. Regional/global implications
5. Major claims with source references

OUTPUT: JSON object matching this structure:
{
  "summary": "...",
  "key_actors": [{"name": "...", "role": "...", "motivations": ["..."]}],
  "power_dynamics": "...",
  "regional_implications": "...",
  "claims": [{"claim": "...", "source_ids": ["article_1"]}]
}`;

    try {
        const response = await callGroqWithFallback({
            messages: [{ role: "user", content: prompt }],
            modelChain: MODEL_CHAINS.CLASSIFY,  // Use higher-reasoning model
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

    const prompt = `
${context}

TASK: Provide an Islamic ethical perspective on this situation.

IMPORTANT GUIDELINES:
- This is ONE interpretation, not authoritative religious ruling
- Focus on universal Islamic principles (justice, mercy, protection of life)
- Be respectful and balanced
- Avoid sectarian positions

OUTPUT: JSON object:
{
  "disclaimer": "This represents one perspective based on general Islamic principles and should not be considered authoritative religious guidance.",
  "ethical_considerations": ["...", "..."],
  "relevant_principles": ["...", "..."],
  "community_impact": "..."
}`;

    try {
        const response = await callGroqWithFallback({
            messages: [{ role: "user", content: prompt }],
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

    const prompt = `
TOPIC: "${topic}"

SITUATION:
${geopolitics.summary}

KEY ACTORS:
${geopolitics.key_actors.map(a => `- ${a.name}: ${a.role}`).join('\n')}

TASK: Generate:
1. Risk matrix (3-5 risks with likelihood, impact, mitigation)
2. Predictions (3-5 scenarios with timeframe, probability, basis)

OUTPUT: JSON object:
{
  "risks": [
    {"risk": "...", "likelihood": "low|medium|high", "impact": "low|medium|high", "mitigation": "..."}
  ],
  "predictions": [
    {"scenario": "...", "timeframe": "...", "probability": "unlikely|possible|likely", "basis": "..."}
  ]
}`;

    try {
        const response = await callGroqWithFallback({
            messages: [{ role: "user", content: prompt }],
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

    const prompt = `
TOPIC: "${topic}"

KEY FINDINGS:
${facts.slice(0, 5).map(f => `- ${f.fact}`).join('\n')}

RISKS:
${risks.map(r => `- ${r.risk} (${r.likelihood} likelihood, ${r.impact} impact)`).join('\n')}

TASK: Generate:
1. Actionable recommendations (for policymakers, activists, community, etc.)
2. Humanitarian impact assessment

OUTPUT: JSON object:
{
  "recommendations": [
    {"action": "...", "target_audience": "...", "priority": "low|medium|high"}
  ],
  "humanitarian": {
    "affected_populations": ["..."],
    "immediate_needs": ["..."],
    "long_term_concerns": ["..."]
  }
}`;

    try {
        const response = await callGroqWithFallback({
            messages: [{ role: "user", content: prompt }],
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
