import { TaskType, TaskComplexity, OrchestratorRequest } from './types.js';

export class ComplexityRouter {
  /**
   * Deterministically evaluates the complexity level for a given task and request.
   * Simple: 1 model
   * Moderate: 1 model (standard)
   * Complex: 2 models
   * Critical: Up to 3 models + 1 evaluator
   */
  public static assessComplexity(request: OrchestratorRequest, taskType: TaskType): TaskComplexity {
    // If complexity routing is explicitly disabled in environment, treat as simple (single model)
    const isEnabled = process.env.AI_COMPLEXITY_ROUTING !== 'false';
    if (!isEnabled) {
      return 'simple';
    }

    const text = `${request.systemPrompt || ''}\n${request.userMessage || ''}`.toLowerCase();
    const messageLength = (request.userMessage || '').trim().length;

    // 1. CRITICAL SIGNALS
    // Multi-module security attack analysis, root-cause architecture failure, high-stakes audit
    if (
      text.includes('attack path') ||
      text.includes('security architecture') ||
      text.includes('root-cause analysis') ||
      text.includes('root cause analysis') ||
      text.includes('major architecture redesign') ||
      text.includes('critical vulnerability') ||
      text.includes('systemic failure') ||
      text.includes('exploit chain') ||
      (taskType === 'security' && (text.includes('owasp') || text.includes('audit')) && messageLength > 200)
    ) {
      return 'critical';
    }

    // 2. COMPLEX SIGNALS
    // Difficult multi-file debugging, cross-module dependency reasoning, intermittent concurrency bugs
    if (
      text.includes('intermittent') ||
      text.includes('intermittently') ||
      text.includes('race condition') ||
      text.includes('deadlock') ||
      text.includes('cross-file') ||
      text.includes('across modules') ||
      text.includes('across multiple') ||
      text.includes('concurrency') ||
      text.includes('memory leak') ||
      (taskType === 'debugging' && (text.includes('why does') || text.includes('investigate'))) ||
      taskType === 'architecture' ||
      taskType === 'security'
    ) {
      return 'complex';
    }

    // 3. MODERATE SIGNALS
    // Standard refactoring, documentation generation, unit testing, single-file code edits
    if (
      text.includes('refactor') ||
      text.includes('improve readability') ||
      text.includes('generate documentation') ||
      text.includes('write tests') ||
      text.includes('unit test') ||
      text.includes('optimize function') ||
      taskType === 'documentation' ||
      taskType === 'testing' ||
      taskType === 'coding'
    ) {
      return 'moderate';
    }

    // 4. SIMPLE SIGNALS (Default)
    // Short explanatory questions, greetings, syntax lookups
    return 'simple';
  }

  /**
   * Retrieves configured maximum parallel model limit (default: 3).
   */
  public static getMaxParallelModels(): number {
    const raw = parseInt(process.env.AI_MAX_PARALLEL_MODELS || '3', 10);
    return isNaN(raw) || raw < 1 ? 3 : Math.min(raw, 5);
  }
}
