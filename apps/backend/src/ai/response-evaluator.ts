import { TaskType, AIModel } from './types.js';
import { ModelRegistry } from './model-registry.js';
import { ProviderRegistry } from './provider-registry.js';
import { KeyManager } from './key-manager.js';
import { OpenAIService, ExecutionContext } from '../services/openai.service.js';

export interface SynthesisOptions {
  originalPrompt: string;
  taskType: TaskType;
  repoContext?: string;
  candidateResponses: Array<{
    candidateId: string;
    modelId: string;
    providerId: string;
    response: string;
  }>;
}

export class ResponseEvaluator {
  /**
   * Selects the most qualified evaluator model from the registry.
   * Prefers models supporting 'reasoning', 'coding', and 'structured_json'.
   */
  public static selectEvaluatorModel(): { model: AIModel; key: string; baseUrl: string; providerName: string } | null {
    const allModels = ModelRegistry.getAllModels().filter((m) => m.enabled);

    // Sort by evaluator fitness: reasoning capability + priority
    const candidates = allModels
      .filter((m) => m.capabilities.includes('reasoning') || m.capabilities.includes('coding'))
      .sort((a, b) => {
        const aReasoning = a.capabilities.includes('reasoning') ? 20 : 0;
        const bReasoning = b.capabilities.includes('reasoning') ? 20 : 0;
        return b.priority + bReasoning - (a.priority + aReasoning);
      });

    for (const model of candidates) {
      const provider = ProviderRegistry.getProvider(model.providerId);
      if (provider && provider.enabled && KeyManager.hasKeys(provider.id)) {
        const key = KeyManager.getKey(provider.id);
        if (key) {
          return {
            model,
            key: key.key,
            baseUrl: provider.baseUrl,
            providerName: provider.name,
          };
        }
      }
    }

    return null;
  }

  /**
   * Synthesizes multiple independent candidate responses into one unified, verified final answer.
   */
  public static async synthesize(options: SynthesisOptions): Promise<string> {
    const { originalPrompt, taskType, repoContext = '', candidateResponses } = options;

    if (!candidateResponses || candidateResponses.length === 0) {
      throw new Error('[ResponseEvaluator] No successful candidate responses to evaluate.');
    }

    // Single candidate optimization: no extra evaluator LLM call required
    if (candidateResponses.length === 1) {
      return candidateResponses[0].response;
    }

    const evaluator = this.selectEvaluatorModel();
    if (!evaluator) {
      // Graceful fallback: return the longest / highest-scored candidate
      console.log('[ResponseEvaluator] Evaluator model unavailable, selecting primary candidate response.');
      return candidateResponses[0].response;
    }

    const formattedCandidates = candidateResponses
      .map((c, i) => `=== CANDIDATE ANALYSIS ${i + 1} ===\n${c.response}`)
      .join('\n\n');

    let taskGuideline = '';
    if (taskType === 'architecture') {
      taskGuideline = '\n5. Ensure system architecture diagrams are formatted as valid Mermaid code blocks (```mermaid ... ```).';
    } else if (taskType === 'security' || taskType === 'debugging') {
      taskGuideline = '\n5. If the request expects a structured JSON array of findings, output the strictly valid JSON structure without conversational preamble.';
    } else if (taskType === 'testing') {
      taskGuideline = '\n5. Ensure test code is formatted as a clean, valid test suite block.';
    }

    const systemPrompt = `You are a Principal Software Architect & Verification Judge.
Your objective:
1. Compare and evaluate the independent candidate analyses provided below.
2. Resolve any factual or architectural discrepancies against the ground-truth repository context.
3. Synthesize the most accurate, thorough, and high-quality solution.
4. Output ONLY the definitive, final user-facing answer. Do NOT reference candidate numbers, models, or judges.${taskGuideline}`;

    const userMessage = `=== ORIGINAL USER REQUEST ===
${originalPrompt}

=== REPOSITORY CODE CONTEXT ===
${repoContext || 'No additional code context provided.'}

=== INDEPENDENT CANDIDATE ANALYSES ===
${formattedCandidates}

Produce the final verified answer:`;

    try {
      const context: ExecutionContext = {
        apiKey: evaluator.key,
        baseURL: evaluator.baseUrl,
        model: evaluator.model.id,
        providerName: evaluator.providerName,
        keyId: 'evaluator',
      };

      const result = await OpenAIService.generate(systemPrompt, userMessage, 3000, context);
      console.log('[AI] Evaluator status=success');
      return result;
    } catch (err: any) {
      console.warn(`[ResponseEvaluator] Evaluation call failed (${err.message}), falling back to top candidate response.`);
      return candidateResponses[0].response;
    }
  }
}
