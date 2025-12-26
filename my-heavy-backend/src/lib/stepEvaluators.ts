/**
 * stepEvaluators.ts
 * Step-specific quality evaluators for the workflow orchestrator
 */

import { StepEvaluation, StepQuality } from './orchestrator';

// ============ HELPER FUNCTIONS ============

function getQuality(score: number): StepQuality {
    if (score >= 80) return 'good';
    if (score >= 40) return 'partial';
    if (score > 0) return 'partial';
    return 'empty';
}

// ============ STEP 1: KEYWORDS ============

interface KeywordsResult {
    keywords?: string[];
}

export function evaluateKeywords(result: KeywordsResult): StepEvaluation {
    const keywords = result?.keywords || [];
    const count = keywords.length;

    if (count >= 5) {
        return { quality: 'good', metrics: { count } };
    }
    if (count >= 3) {
        return { quality: 'partial', issue: 'Fewer keywords than ideal', metrics: { count } };
    }
    if (count > 0) {
        return { quality: 'partial', issue: `Only ${count} keyword(s) generated`, metrics: { count } };
    }
    return { quality: 'empty', issue: 'No keywords generated', metrics: { count: 0 } };
}

// ============ STEP 2: SEARCH ============

interface SearchResult {
    results?: Array<{ url: string; title: string }>;
}

export function evaluateSearch(result: SearchResult): StepEvaluation {
    const results = result?.results || [];
    const count = results.length;

    if (count >= 10) {
        return { quality: 'good', metrics: { count } };
    }
    if (count >= 5) {
        return { quality: 'partial', issue: 'Fewer search results than ideal', metrics: { count } };
    }
    if (count > 0) {
        return { quality: 'partial', issue: `Only ${count} result(s) found`, metrics: { count } };
    }
    return { quality: 'empty', issue: 'No search results found', metrics: { count: 0 } };
}

// ============ STEP 3: SCRAPE ============

interface ScrapeResult {
    results?: Array<{ status: string; markdown?: string }>;
}

export function evaluateScrape(result: ScrapeResult): StepEvaluation {
    const results = result?.results || [];
    const successful = results.filter(r => r.status === 'success' && r.markdown && r.markdown.length > 500);
    const successRate = results.length > 0 ? (successful.length / results.length) * 100 : 0;

    return {
        quality: getQuality(successRate),
        issue: successRate < 80 ? `${100 - Math.round(successRate)}% of scrapes failed or empty` : undefined,
        metrics: { total: results.length, successful: successful.length, successRate: Math.round(successRate) }
    };
}

// ============ STEP 4: STRUCTURE ============

interface StructuredArticle {
    article_index: number;
    headline?: string;
}

interface StructureResult {
    articles?: StructuredArticle[];
}

export function evaluateStructure(result: StructureResult): StepEvaluation {
    const articles = result?.articles || [];
    const valid = articles.filter(a => a.headline && a.headline.length > 5);
    const validRate = articles.length > 0 ? (valid.length / articles.length) * 100 : 0;

    return {
        quality: getQuality(validRate),
        issue: validRate < 80 ? `${articles.length - valid.length} article(s) failed to structure` : undefined,
        metrics: { total: articles.length, valid: valid.length }
    };
}

// ============ STEP 5: SUMMARIZE ============

interface SummarizedArticle {
    headline_summary?: string;
    summary_bullets?: string[];
}

interface SummarizeResult {
    articles?: SummarizedArticle[];
}

export function evaluateSummarize(result: SummarizeResult): StepEvaluation {
    const articles = result?.articles || [];
    const valid = articles.filter(a =>
        a.headline_summary &&
        a.summary_bullets &&
        a.summary_bullets.length > 0
    );
    const validRate = articles.length > 0 ? (valid.length / articles.length) * 100 : 0;

    return {
        quality: getQuality(validRate),
        issue: validRate < 80 ? `${articles.length - valid.length} article(s) failed to summarize` : undefined,
        metrics: { total: articles.length, summarized: valid.length }
    };
}

// ============ STEP 6: QUERIES ============

interface QueriesResult {
    queries?: string[];
}

export function evaluateQueries(result: QueriesResult): StepEvaluation {
    const queries = result?.queries || [];
    const count = queries.length;

    if (count >= 3) {
        return { quality: 'good', metrics: { count } };
    }
    if (count > 0) {
        return { quality: 'partial', issue: `Only ${count} query generated`, metrics: { count } };
    }
    return { quality: 'empty', issue: 'No video queries generated', metrics: { count: 0 } };
}

// ============ STEP 7: VIDEOS ============

interface Video {
    id: string;
    title: string;
}

interface VideosResult {
    videos?: Video[];
}

export function evaluateVideos(result: VideosResult): StepEvaluation {
    const videos = result?.videos || [];
    const count = videos.length;

    if (count >= 5) {
        return { quality: 'good', metrics: { count } };
    }
    if (count >= 1) {
        return { quality: 'partial', issue: `Only ${count} video(s) found`, metrics: { count } };
    }
    return { quality: 'empty', issue: 'No videos found', metrics: { count: 0 } };
}

// ============ STEP 8: TRANSCRIBE ============

interface TranscribedVideo {
    id: string;
    transcript?: string;
}

interface TranscribeResult {
    videos?: TranscribedVideo[];
}

export function evaluateTranscribe(result: TranscribeResult): StepEvaluation {
    const videos = result?.videos || [];
    const withTranscript = videos.filter(v => v.transcript && v.transcript.length > 100);
    const successRate = videos.length > 0 ? (withTranscript.length / videos.length) * 100 : 0;

    return {
        quality: getQuality(successRate),
        issue: successRate < 80 ? `${videos.length - withTranscript.length} video(s) have no transcript` : undefined,
        metrics: { total: videos.length, transcribed: withTranscript.length, successRate: Math.round(successRate) }
    };
}

// ============ STEP 9: VERIFY/CLASSIFY ============

interface ClassifiedVideo {
    id: string;
    relevance_score?: number;
}

interface ClassifyResult {
    kept_videos?: ClassifiedVideo[];
    stats?: { total: number; kept: number };
}

export function evaluateClassify(result: ClassifyResult): StepEvaluation {
    const kept = result?.kept_videos?.length || 0;
    const total = result?.stats?.total || 0;

    if (kept >= 3) {
        return { quality: 'good', metrics: { kept, total } };
    }
    if (kept >= 1) {
        return { quality: 'partial', issue: `Only ${kept} video(s) passed classification`, metrics: { kept, total } };
    }
    return { quality: 'empty', issue: 'No videos passed classification', metrics: { kept: 0, total } };
}

// ============ STEP 10: NORMALIZE ============

interface NormalizedSource {
    id: string;
    type: string;
}

interface NormalizeResult {
    sources?: NormalizedSource[];
}

export function evaluateNormalize(result: NormalizeResult): StepEvaluation {
    const sources = result?.sources || [];
    const count = sources.length;

    if (count >= 5) {
        return { quality: 'good', metrics: { count } };
    }
    if (count >= 1) {
        return { quality: 'partial', issue: `Only ${count} source(s) normalized`, metrics: { count } };
    }
    return { quality: 'empty', issue: 'No sources to normalize', metrics: { count: 0 } };
}

// ============ STEP 11: DEEP ANALYSIS ============

interface AnalysisResult {
    topic?: string;
    quality_metrics?: {
        confidence_grade?: string;
        source_diversity_score?: number;
    };
}

export function evaluateAnalysis(result: AnalysisResult): StepEvaluation {
    const grade = result?.quality_metrics?.confidence_grade || 'F';
    const diversity = result?.quality_metrics?.source_diversity_score || 0;

    const gradeScore = { 'A': 100, 'B': 80, 'C': 60, 'D': 40, 'F': 0 }[grade] || 0;
    const avgScore = (gradeScore + diversity * 100) / 2;

    return {
        quality: getQuality(avgScore),
        issue: avgScore < 60 ? `Analysis quality: ${grade}, diversity: ${Math.round(diversity * 100)}%` : undefined,
        metrics: { grade, diversityScore: Math.round(diversity * 100) }
    };
}

// ============ STEP 12: CONTENT IDEAS ============

interface ContentIdeasResult {
    stats?: {
        total_ideas?: number;
    };
}

export function evaluateContentIdeas(result: ContentIdeasResult): StepEvaluation {
    const count = result?.stats?.total_ideas || 0;

    if (count >= 5) {
        return { quality: 'good', metrics: { count } };
    }
    if (count >= 1) {
        return { quality: 'partial', issue: `Only ${count} content idea(s) generated`, metrics: { count } };
    }
    return { quality: 'empty', issue: 'No content ideas generated', metrics: { count: 0 } };
}

// ============ STEP 13: REPORT ============

interface ReportResult {
    report_id?: string;
    quality_check?: {
        grade?: string;
    };
}

export function evaluateReport(result: ReportResult): StepEvaluation {
    if (!result?.report_id) {
        return { quality: 'error', issue: 'Report not generated' };
    }

    const grade = result?.quality_check?.grade || 'C';
    const gradeScore = { 'A': 100, 'B': 80, 'C': 60, 'D': 40, 'F': 0 }[grade] || 0;

    return {
        quality: getQuality(gradeScore),
        issue: gradeScore < 60 ? `Report quality grade: ${grade}` : undefined,
        metrics: { reportId: result.report_id, grade }
    };
}

// ============ NEWS (Legacy Step 1) ============

interface NewsResult {
    newsSummary?: string;
    sources?: Array<{ title: string; url: string }>;
}

export function evaluateNews(result: NewsResult): StepEvaluation {
    const sources = result?.sources || [];
    const hasSummary = result?.newsSummary && result.newsSummary.length > 100;
    const count = sources.length;

    if (hasSummary && count >= 5) {
        return { quality: 'good', metrics: { sourceCount: count, hasSummary: 'yes' } };
    }
    if (hasSummary || count > 0) {
        return {
            quality: 'partial',
            issue: !hasSummary ? 'Summary too short' : `Only ${count} source(s)`,
            metrics: { sourceCount: count, hasSummary: hasSummary ? 'yes' : 'no' }
        };
    }
    return { quality: 'empty', issue: 'No news found', metrics: { sourceCount: 0, hasSummary: 'no' } };
}

// ============ DEEP RESEARCH (Legacy Step 1.5) ============

interface DeepResearchResult {
    deepAnalysis?: string;
}

export function evaluateDeepResearch(result: DeepResearchResult): StepEvaluation {
    const analysis = result?.deepAnalysis || '';
    const length = analysis.length;

    if (length >= 500) {
        return { quality: 'good', metrics: { length } };
    }
    if (length >= 100) {
        return { quality: 'partial', issue: 'Deep analysis is brief', metrics: { length } };
    }
    if (length > 0) {
        return { quality: 'partial', issue: 'Deep analysis too short', metrics: { length } };
    }
    return { quality: 'empty', issue: 'No deep analysis generated', metrics: { length: 0 } };
}

// ============ EXPORT ALL EVALUATORS ============

export const stepEvaluators = {
    keywords: evaluateKeywords,
    search: evaluateSearch,
    scrape: evaluateScrape,
    structure: evaluateStructure,
    summarize: evaluateSummarize,
    queries: evaluateQueries,
    videos: evaluateVideos,
    transcribe: evaluateTranscribe,
    classify: evaluateClassify,
    normalize: evaluateNormalize,
    analysis: evaluateAnalysis,
    contentIdeas: evaluateContentIdeas,
    report: evaluateReport,
    news: evaluateNews,
    deepResearch: evaluateDeepResearch
};
