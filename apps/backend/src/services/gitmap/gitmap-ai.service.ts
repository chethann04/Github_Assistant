import prisma from '../../config/prisma.js';
import { LLMService } from '../llm.service.js';
import {
  GitMapGraphPayload,
  HowItWorksResponse,
  ImpactAnalysisResponse,
  OnboardingStep,
  ArchitectureFlowStep,
  GitMapNode,
} from './gitmap.types.js';

export class GitMapAIService {
  /**
   * Stage B: Asynchronous AI enrichment of the repository overview & onboarding guide
   */
  public static async enrichAnalysis(
    analysisId: string,
    repoId: string,
    payload: GitMapGraphPayload
  ): Promise<void> {
    try {
      const topModules = payload.modules
        .sort((a, b) => b.importanceScore - a.importanceScore)
        .slice(0, 8);

      const entryPoints = payload.nodes
        .filter((n) => n.isEntryPoint || n.importanceScore >= 70)
        .slice(0, 10);

      const prompt = `You are a Principal Software Architect analyzing a GitHub repository.
Here is the static architectural metadata:
- Total Files: ${payload.stats.totalFiles}
- Modules: ${topModules.map((m) => `${m.name} (${m.category}, ${m.fileCount} files)`).join(', ')}
- Key Entry Points / High-Importance Files: ${entryPoints.map((n) => n.path).join(', ')}
- Manifest Dependencies: ${payload.dependencies.slice(0, 15).map((d) => d.name).join(', ')}

Please provide a JSON response with:
1. "overviewSummary": A concise 2-3 paragraph architectural overview explaining what the repository does, its primary tech stack, and how its layers communicate.
2. "onboardingGuide": An array of 5 curated onboarding steps in reading order ("Start Here"), each with:
   - step: number (1 to 5)
   - title: string
   - path: string (exact file path from the repository)
   - type: "ENTRY_POINT" | "CORE_BUSINESS" | "API_LAYER" | "DATABASE_LAYER" | "CONFIGURATION"
   - whatItDoes: string
   - whyItMatters: string
   - connectsTo: array of strings

Respond ONLY with valid JSON.`;

      const text = await LLMService.generate(
        'You are an expert software architecture engine. Always output pure valid JSON without markdown fences.',
        prompt
      );

      let parsed: any = null;
      try {
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        // Fallback deterministic onboarding guide if LLM response isn't JSON
        parsed = {
          overviewSummary: `This repository contains ${payload.stats.totalFiles} files organized into ${payload.modules.length} functional modules. The core architecture bridges ${topModules.map(m => m.name).slice(0, 3).join(', ')} with an integrated build pipeline.`,
          onboardingGuide: entryPoints.slice(0, 5).map((ep, idx) => ({
            step: idx + 1,
            title: ep.name,
            path: ep.path,
            type: ep.isEntryPoint ? 'ENTRY_POINT' : 'CORE_BUSINESS',
            whatItDoes: `Core ${ep.category.toLowerCase()} module handling system execution.`,
            whyItMatters: `High architectural importance score (${ep.importanceScore}/100) with direct connections.`,
            connectsTo: ep.imports.slice(0, 3),
          })),
        };
      }

      await (prisma as any).gitMapAnalysis.update({
        where: { id: analysisId },
        data: {
          overviewSummary: parsed.overviewSummary,
          onboardingGuide: parsed.onboardingGuide as any,
        },
      });

      console.log(`[GitMapAIService] Successfully enriched GitMap analysis ${analysisId}`);
    } catch (err: any) {
      console.warn(`[GitMapAIService] AI enrichment warning: ${err.message}`);
    }
  }

  /**
   * "How does this work?" - Dynamic Graph Traversal & Traceable Path Q&A
   */
  public static async answerHowItWorks(
    payload: GitMapGraphPayload,
    query: string
  ): Promise<HowItWorksResponse> {
    const lowerQuery = query.toLowerCase();
    const queryTokens = lowerQuery.split(/\s+/).filter((t) => t.length > 2);

    // 1. Dynamic Context Selection via Graph Traversal
    const matchingNodes: GitMapNode[] = [];
    for (const node of payload.nodes) {
      const matchScore =
        (queryTokens.some((t) => node.path.toLowerCase().includes(t)) ? 3 : 0) +
        (queryTokens.some((t) => node.category.toLowerCase().includes(t)) ? 2 : 0) +
        (queryTokens.some((t) => (node.apiEndpoints || []).some((ep) => ep.toLowerCase().includes(t))) ? 4 : 0);

      if (matchScore > 0) {
        matchingNodes.push(node);
      }
    }

    // If no direct matches, fallback to highest importance entry points
    const seedNodes = matchingNodes.length > 0
      ? matchingNodes.slice(0, 6)
      : payload.nodes.filter((n) => n.importanceScore >= 60).slice(0, 5);

    // Collect connected 1-hop and 2-hop neighborhood in the graph
    const seedPaths = new Set(seedNodes.map((n) => n.id));
    const connectedNodeIds = new Set<string>(seedPaths);
    const highlightedEdgeIds: string[] = [];

    for (const edge of payload.edges) {
      if (seedPaths.has(edge.source)) {
        connectedNodeIds.add(edge.target);
        highlightedEdgeIds.push(edge.id);
      } else if (seedPaths.has(edge.target)) {
        connectedNodeIds.add(edge.source);
        highlightedEdgeIds.push(edge.id);
      }
    }

    const relevantNodes = payload.nodes.filter((n) => connectedNodeIds.has(n.id)).slice(0, 15);
    const involvedModules = Array.from(new Set(relevantNodes.map((n) => n.moduleName)));

    // 2. Prompt LLM with Selected Subgraph Context
    const prompt = `The developer asked: "${query}"

Here is the exact code relationship subgraph from the repository:
- Relevant Nodes: ${relevantNodes.map((n) => `${n.path} [${n.category}] (Imports: ${n.imports.slice(0, 3).join(', ')})`).join('\n')}
- Graph Connections: ${payload.edges.filter((e) => connectedNodeIds.has(e.source) && connectedNodeIds.has(e.target)).map((e) => `${e.source} -> ${e.target} (${e.type})`).join('\n')}

Generate a traceable, step-by-step execution path explaining how this workflow executes through the codebase.
Respond in valid JSON format:
{
  "overview": "A clear 2-sentence explanation of the feature flow",
  "executionPath": [
    {
      "order": 1,
      "component": "Component or File Name",
      "nodeId": "exact file path or empty string",
      "action": "Action taken (e.g. User submits login form)",
      "target": "Next recipient",
      "targetNodeId": "next file path",
      "description": "Specific code logic or method execution details"
    }
  ]
}`;

    const text = await LLMService.generate(
      'You are an architecture tracing assistant. Output pure valid JSON.',
      prompt
    );

    let parsed: any = null;
    try {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        overview: `The workflow for "${query}" traverses through ${relevantNodes.length} key components across ${involvedModules.join(', ')}.`,
        executionPath: relevantNodes.slice(0, 5).map((rn, idx) => ({
          order: idx + 1,
          component: rn.name,
          nodeId: rn.id,
          action: `Processes ${rn.category.toLowerCase()} logic`,
          target: relevantNodes[idx + 1]?.name || 'System Output',
          targetNodeId: relevantNodes[idx + 1]?.id || '',
          description: `Handles request execution in ${rn.path}`,
        })),
      };
    }

    return {
      query,
      overview: parsed.overview || `Architecture execution flow for ${query}`,
      executionPath: parsed.executionPath || [],
      highlightedNodeIds: Array.from(connectedNodeIds),
      highlightedEdgeIds,
      involvedModules,
      keyFiles: relevantNodes.map((n) => ({ path: n.id, role: n.moduleName })),
    };
  }

  /**
   * Deep Graph Blast Radius Impact Analysis
   */
  public static async analyzeImpact(
    payload: GitMapGraphPayload,
    targetFilePath: string
  ): Promise<ImpactAnalysisResponse> {
    const targetNode = payload.nodes.find((n) => n.id === targetFilePath);
    if (!targetNode) {
      throw new Error(`Target file ${targetFilePath} not found in graph`);
    }

    // Direct dependents (who imports or calls target)
    const directDependents: ImpactAnalysisResponse['directDependents'] = [];
    const directIds = new Set<string>();
    const highlightedEdgeIds: string[] = [];

    for (const edge of payload.edges) {
      if (edge.target === targetFilePath && edge.source !== targetFilePath) {
        directIds.add(edge.source);
        highlightedEdgeIds.push(edge.id);
        directDependents.push({
          id: edge.source,
          path: edge.source,
          relationship: edge.type,
          confidence: edge.confidence || 'CONFIRMED',
        });
      }
    }

    // Indirect dependents (depth 2)
    const indirectDependents: ImpactAnalysisResponse['indirectDependents'] = [];
    const allAffectedIds = new Set<string>([targetFilePath, ...directIds]);

    for (const edge of payload.edges) {
      if (directIds.has(edge.target) && !allAffectedIds.has(edge.source)) {
        allAffectedIds.add(edge.source);
        highlightedEdgeIds.push(edge.id);
        indirectDependents.push({
          id: edge.source,
          path: edge.source,
          depth: 2,
        });
      }
    }

    const affectedNodes = payload.nodes.filter((n) => allAffectedIds.has(n.id));
    const affectedModules = Array.from(new Set(affectedNodes.map((n) => n.moduleName)));

    let impactLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (directDependents.length >= 6 || targetNode.category === 'DATABASE' || targetNode.category === 'AUTH') {
      impactLevel = 'CRITICAL';
    } else if (directDependents.length >= 3 || indirectDependents.length >= 5) {
      impactLevel = 'HIGH';
    } else if (directDependents.length >= 1) {
      impactLevel = 'MEDIUM';
    }

    // Generate AI explanation of impact
    let aiExplanation = `Modifying ${targetNode.name} impacts ${directDependents.length} direct dependent file(s) and ${indirectDependents.length} secondary file(s) across ${affectedModules.length} module(s).`;
    const recommendations = [
      `Review interfaces exported by ${targetNode.name} to avoid breaking downstream callers.`,
      `Run test suites covering dependent modules: ${affectedModules.slice(0, 3).join(', ')}.`,
    ];

    try {
      const prompt = `Explain the impact of modifying "${targetFilePath}" (${targetNode.category}) in a software repository.
Direct dependents: ${directDependents.map((d) => d.path).join(', ') || 'None'}
Indirect dependents: ${indirectDependents.map((d) => d.path).join(', ') || 'None'}
Affected Modules: ${affectedModules.join(', ')}

Provide a concise 2-sentence summary of the ripple effects and 2 specific risk mitigation recommendations.
Format as JSON: { "summary": "...", "recommendations": ["...", "..."] }`;

      const text = await LLMService.generate(
        'You are an architecture impact analysis engine. Output valid JSON only.',
        prompt
      );

      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.summary) aiExplanation = parsed.summary;
      if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
        recommendations.push(...parsed.recommendations);
      }
    } catch {}

    return {
      targetNodeId: targetFilePath,
      targetName: targetNode.name,
      targetCategory: targetNode.category,
      impactLevel,
      directDependentsCount: directDependents.length,
      indirectDependentsCount: indirectDependents.length,
      affectedModulesCount: affectedModules.length,
      affectedModules,
      directDependents,
      indirectDependents,
      aiExplanation,
      riskMitigationRecommendations: Array.from(new Set(recommendations)),
      highlightedNodeIds: Array.from(allAffectedIds),
      highlightedEdgeIds,
    };
  }
}
