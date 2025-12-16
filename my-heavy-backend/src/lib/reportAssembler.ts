/**
 * reportAssembler.ts
 * Assembles all research components into a final presentable report
 * Outputs both structured JSON and formatted Markdown
 */

import { CanonicalSource } from './groqNormalize';
import { DeepAnalysis } from './groqDeepAnalysis';
import { ContentIdea, ContentIdeasResult } from './groqContentIdeas';

// ============ INTERFACES ============

export interface ReportInput {
    topic: string;
    executive_summary?: string;
    sources: CanonicalSource[];
    deep_analysis: DeepAnalysis;
    content_ideas: ContentIdeasResult;
}

export interface QualityCheck {
    schema_valid: boolean;
    sources_count: number;
    claims_with_sources: number;
    empty_sections: string[];
    grade: 'A' | 'B' | 'C' | 'D';
    issues: string[];
}

export interface AuditLog {
    steps_completed: string[];
    warnings: string[];
    generated_at: string;
    processing_time_ms?: number;
}

export interface FinalReport {
    report_id: string;
    version: number;
    topic: string;
    generated_at: string;

    // Structured data
    data: {
        sources: CanonicalSource[];
        deep_analysis: DeepAnalysis;
        content_ideas: ContentIdea[];
    };

    // Presentable content
    formatted_report: string;  // Markdown

    // Quality
    quality_check: QualityCheck;
    audit_log: AuditLog;
}

// ============ QUALITY CHECKER ============

function runQualityCheck(input: ReportInput): QualityCheck {
    const issues: string[] = [];
    const emptySection: string[] = [];

    // Check sources
    if (!input.sources || input.sources.length === 0) {
        issues.push('No sources provided');
        emptySection.push('sources');
    }

    // Check deep analysis
    if (!input.deep_analysis) {
        issues.push('No deep analysis provided');
        emptySection.push('deep_analysis');
    } else {
        if (input.deep_analysis.key_facts.length === 0) {
            emptySection.push('key_facts');
        }
        if (!input.deep_analysis.geopolitical_analysis.summary) {
            emptySection.push('geopolitical_summary');
        }
        if (input.deep_analysis.recommendations.length === 0) {
            emptySection.push('recommendations');
        }
    }

    // Check content ideas
    if (!input.content_ideas || input.content_ideas.content_ideas.length === 0) {
        issues.push('No content ideas generated');
        emptySection.push('content_ideas');
    }

    // Calculate grade
    const issueCount = issues.length + emptySection.length;
    let grade: 'A' | 'B' | 'C' | 'D';
    if (issueCount === 0) grade = 'A';
    else if (issueCount <= 2) grade = 'B';
    else if (issueCount <= 4) grade = 'C';
    else grade = 'D';

    // Count claims with sources
    const claimsWithSources = input.deep_analysis?.key_facts
        .filter(f => f.source_ids.length > 0).length || 0;

    return {
        schema_valid: issues.length === 0,
        sources_count: input.sources?.length || 0,
        claims_with_sources: claimsWithSources,
        empty_sections: emptySection,
        grade,
        issues
    };
}

// ============ MARKDOWN FORMATTER ============

function formatReportMarkdown(input: ReportInput): string {
    const { topic, sources, deep_analysis, content_ideas } = input;
    const date = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    let md = '';

    // Header
    md += `# 🔍 Intelligence Report: ${topic}\n`;
    md += `*Generated on ${date}*\n\n`;
    md += `---\n\n`;

    // Executive Summary
    md += `## 📋 Executive Summary\n\n`;
    if (input.executive_summary) {
        md += `${input.executive_summary}\n\n`;
    } else if (deep_analysis?.geopolitical_analysis?.summary) {
        md += `${deep_analysis.geopolitical_analysis.summary}\n\n`;
    }

    // Key Findings
    md += `## 🎯 Key Findings\n\n`;
    if (deep_analysis?.key_facts && deep_analysis.key_facts.length > 0) {
        deep_analysis.key_facts.forEach((fact, i) => {
            const verified = fact.verified ? '✓' : '○';
            md += `${i + 1}. ${verified} ${fact.fact}\n`;
        });
    }
    md += `\n`;

    // Geopolitical Analysis
    md += `## 🌍 Geopolitical Analysis\n\n`;

    if (deep_analysis?.geopolitical_analysis) {
        const geo = deep_analysis.geopolitical_analysis;

        // Key Actors
        if (geo.key_actors && geo.key_actors.length > 0) {
            md += `### Key Actors\n\n`;
            geo.key_actors.forEach(actor => {
                md += `**${actor.name}** - ${actor.role}\n`;
                if (actor.motivations && actor.motivations.length > 0) {
                    md += `> Motivations: ${actor.motivations.join(', ')}\n`;
                }
                md += `\n`;
            });
        }

        // Power Dynamics
        if (geo.power_dynamics) {
            md += `### Power Dynamics\n\n`;
            md += `${geo.power_dynamics}\n\n`;
        }

        // Regional Implications
        if (geo.regional_implications) {
            md += `### Regional Implications\n\n`;
            md += `${geo.regional_implications}\n\n`;
        }
    }

    // Islamic Perspective
    if (deep_analysis?.islamic_perspective) {
        const islamic = deep_analysis.islamic_perspective;
        md += `## ☪️ Islamic Perspective\n\n`;
        md += `> ⚠️ *${islamic.disclaimer}*\n\n`;

        if (islamic.ethical_considerations && islamic.ethical_considerations.length > 0) {
            md += `### Ethical Considerations\n\n`;
            islamic.ethical_considerations.forEach(c => {
                md += `- ${c}\n`;
            });
            md += `\n`;
        }

        if (islamic.relevant_principles && islamic.relevant_principles.length > 0) {
            md += `### Relevant Principles\n\n`;
            islamic.relevant_principles.forEach(p => {
                md += `- ${p}\n`;
            });
            md += `\n`;
        }

        if (islamic.community_impact) {
            md += `### Community Impact\n\n`;
            md += `${islamic.community_impact}\n\n`;
        }
    }

    // Risk Assessment
    if (deep_analysis?.risk_matrix && deep_analysis.risk_matrix.length > 0) {
        md += `## ⚠️ Risk Assessment\n\n`;
        md += `| Risk | Likelihood | Impact | Mitigation |\n`;
        md += `|------|------------|--------|------------|\n`;
        deep_analysis.risk_matrix.forEach(risk => {
            md += `| ${risk.risk} | ${risk.likelihood} | ${risk.impact} | ${risk.mitigation} |\n`;
        });
        md += `\n`;
    }

    // Predictions
    if (deep_analysis?.predictions && deep_analysis.predictions.length > 0) {
        md += `## 🔮 Predictions\n\n`;
        deep_analysis.predictions.forEach((pred, i) => {
            md += `### Scenario ${i + 1}: ${pred.scenario}\n`;
            md += `- **Timeframe:** ${pred.timeframe}\n`;
            md += `- **Probability:** ${pred.probability}\n`;
            md += `- **Basis:** ${pred.basis}\n\n`;
        });
    }

    // Recommendations
    if (deep_analysis?.recommendations && deep_analysis.recommendations.length > 0) {
        md += `## 💡 Recommendations\n\n`;
        deep_analysis.recommendations.forEach((rec, i) => {
            const priority = '🔴'.repeat(Math.min(rec.priority === 'high' ? 3 : rec.priority === 'medium' ? 2 : 1, 3));
            md += `${i + 1}. **${rec.action}**\n`;
            md += `   - Target: ${rec.target_audience}\n`;
            md += `   - Priority: ${priority}\n\n`;
        });
    }

    // Humanitarian Impact
    if (deep_analysis?.humanitarian_impact) {
        const hum = deep_analysis.humanitarian_impact;
        md += `## 🤝 Humanitarian Impact\n\n`;

        if (hum.affected_populations && hum.affected_populations.length > 0) {
            md += `**Affected Populations:** ${hum.affected_populations.join(', ')}\n\n`;
        }

        if (hum.immediate_needs && hum.immediate_needs.length > 0) {
            md += `**Immediate Needs:**\n`;
            hum.immediate_needs.forEach(n => md += `- ${n}\n`);
            md += `\n`;
        }

        if (hum.long_term_concerns && hum.long_term_concerns.length > 0) {
            md += `**Long-term Concerns:**\n`;
            hum.long_term_concerns.forEach(c => md += `- ${c}\n`);
            md += `\n`;
        }
    }

    // Content Ideas
    if (content_ideas?.content_ideas && content_ideas.content_ideas.length > 0) {
        md += `---\n\n`;
        md += `## 📱 Content Ideas\n\n`;
        md += `*Ready-to-use ideas for social media content*\n\n`;

        // Group by platform
        const platforms = new Map<string, ContentIdea[]>();
        content_ideas.content_ideas.forEach(idea => {
            const list = platforms.get(idea.platform) || [];
            list.push(idea);
            platforms.set(idea.platform, list);
        });

        platforms.forEach((ideas, platform) => {
            const platformName = platform.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            md += `### ${platformName}\n\n`;

            ideas.forEach((idea, i) => {
                const priorityStars = '⭐'.repeat(6 - idea.priority);
                md += `**Idea ${i + 1}** ${priorityStars}\n\n`;
                md += `> 🎣 **Hook:** "${idea.hook}"\n\n`;
                md += `**Script:**\n${idea.script}\n\n`;
                md += `**Visual Style:** ${idea.visual_style}\n\n`;
                md += `**CTA:** ${idea.call_to_action}\n\n`;

                if (idea.hashtags && idea.hashtags.length > 0) {
                    md += `**Hashtags:** ${idea.hashtags.join(' ')}\n\n`;
                }

                if (idea.sensitivity_level !== 'standard') {
                    md += `⚠️ **Sensitivity:** ${idea.sensitivity_level}\n`;
                    if (idea.ethical_notes && idea.ethical_notes.length > 0) {
                        md += `> ${idea.ethical_notes.join('; ')}\n`;
                    }
                    md += `\n`;
                }

                md += `---\n\n`;
            });
        });
    }

    // Sources
    if (sources && sources.length > 0) {
        md += `## 📚 Sources\n\n`;
        sources.forEach((source, i) => {
            const icon = source.type === 'video' ? '🎥' : '📰';
            const credibility = source.credibility === 'high' ? '✓' : '';
            md += `${i + 1}. ${icon} [${source.title}](${source.url}) ${credibility}\n`;
            md += `   - *${source.source}* | ${source.date}\n`;
        });
    }

    // Footer
    md += `\n---\n\n`;
    md += `*This report was auto-generated by Insight Research Agent.*\n`;
    md += `*Quality Grade: ${deep_analysis?.quality_metrics?.confidence_grade || 'N/A'}*\n`;

    return md;
}

// ============ MAIN ASSEMBLER ============

export function assembleReport(input: ReportInput): FinalReport {
    console.log(`[ReportAssembler] Assembling report for: "${input.topic}"`);
    const startTime = Date.now();

    // Generate report ID
    const dateStr = new Date().toISOString().split('T')[0];
    const topicSlug = input.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    const reportId = `${topicSlug}_${dateStr}`;

    // Run quality check
    const qualityCheck = runQualityCheck(input);
    console.log(`[ReportAssembler] Quality grade: ${qualityCheck.grade}`);

    // Format as Markdown
    const formattedReport = formatReportMarkdown(input);
    console.log(`[ReportAssembler] Formatted report: ${formattedReport.length} characters`);

    // Create audit log
    const auditLog: AuditLog = {
        steps_completed: [
            'sources_normalized',
            'deep_analysis_complete',
            'content_ideas_generated',
            'report_formatted',
            'quality_checked'
        ],
        warnings: qualityCheck.issues,
        generated_at: new Date().toISOString(),
        processing_time_ms: Date.now() - startTime
    };

    // Assemble final report
    const report: FinalReport = {
        report_id: reportId,
        version: 1,
        topic: input.topic,
        generated_at: new Date().toISOString(),
        data: {
            sources: input.sources,
            deep_analysis: input.deep_analysis,
            content_ideas: input.content_ideas.content_ideas
        },
        formatted_report: formattedReport,
        quality_check: qualityCheck,
        audit_log: auditLog
    };

    console.log(`[ReportAssembler] Report assembled. ID: ${reportId}`);
    return report;
}
