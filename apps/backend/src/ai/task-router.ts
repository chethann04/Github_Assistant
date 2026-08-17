import { TaskType, AIModelCapability, OrchestratorRequest } from './types.js';

export class TaskRouter {
  /**
   * Deterministically detects the TaskType for an incoming orchestrator request
   * without incurring any LLM overhead or latency.
   */
  public static detectTask(request: OrchestratorRequest): TaskType {
    // 1. If the caller explicitly supplied a valid taskType, trust and normalize it
    if (request.taskType) {
      return this.normalizeTaskType(request.taskType);
    }

    const combinedText = `${request.systemPrompt || ''}\n${request.userMessage || ''}`.toLowerCase();

    // 2. Security analysis
    if (
      combinedText.includes('security') ||
      combinedText.includes('vulnerability') ||
      combinedText.includes('cwe') ||
      combinedText.includes('injection') ||
      combinedText.includes('secret leak') ||
      combinedText.includes('hardcoded secret') ||
      combinedText.includes('owasp')
    ) {
      return 'security';
    }

    // 3. Architecture & System Structure
    if (
      combinedText.includes('architecture') ||
      combinedText.includes('mermaid') ||
      combinedText.includes('system design') ||
      combinedText.includes('component diagram') ||
      combinedText.includes('dependency graph') ||
      combinedText.includes('impact analysis')
    ) {
      return 'architecture';
    }

    // 4. Testing & Test generation
    if (
      combinedText.includes('test suite') ||
      combinedText.includes('vitest') ||
      combinedText.includes('jest') ||
      combinedText.includes('unit test') ||
      combinedText.includes('assertions') ||
      combinedText.includes('edge cases')
    ) {
      return 'testing';
    }

    // 5. Bug detection & Debugging
    if (
      combinedText.includes('detect bug') ||
      combinedText.includes('bug issue') ||
      combinedText.includes('debugging') ||
      combinedText.includes('code review issue') ||
      combinedText.includes('find bugs') ||
      combinedText.includes('diagnose error')
    ) {
      return 'debugging';
    }

    // 6. Documentation generation
    if (
      combinedText.includes('documentation') ||
      combinedText.includes('readme') ||
      combinedText.includes('docstring') ||
      combinedText.includes('api contract') ||
      combinedText.includes('generate docs')
    ) {
      return 'documentation';
    }

    // 7. Reasoning & Complex Logic
    if (
      combinedText.includes('step-by-step reasoning') ||
      combinedText.includes('logical deduction') ||
      combinedText.includes('mathematical proof')
    ) {
      return 'reasoning';
    }

    // 8. General Coding & Refactoring
    if (
      combinedText.includes('refactor') ||
      combinedText.includes('code implementation') ||
      combinedText.includes('typescript function') ||
      combinedText.includes('explain this snippet') ||
      combinedText.includes('syntax tree')
    ) {
      return 'coding';
    }

    // 9. Default to standard conversational chat
    return 'chat';
  }

  /**
   * Normalizes legacy or aliased task types to standard TaskType enum.
   */
  public static normalizeTaskType(taskType: string): TaskType {
    const lower = taskType.toLowerCase().trim();
    switch (lower) {
      case 'architecture':
      case 'impact_analysis':
        return 'architecture';
      case 'security':
      case 'security_scan':
        return 'security';
      case 'testing':
      case 'test_generation':
        return 'testing';
      case 'debugging':
      case 'bug_detection':
        return 'debugging';
      case 'documentation':
      case 'doc_generation':
        return 'documentation';
      case 'coding':
      case 'code_review':
      case 'explanation':
        return 'coding';
      case 'reasoning':
        return 'reasoning';
      case 'general':
        return 'general';
      case 'chat':
      default:
        return 'chat';
    }
  }

  /**
   * Maps a high-level TaskType to the primary AIModelCapability required.
   */
  public static getRequiredCapabilityForTask(taskType: TaskType): AIModelCapability {
    switch (taskType) {
      case 'architecture':
        return 'architecture';
      case 'security':
      case 'security_scan':
        return 'security';
      case 'testing':
      case 'test_generation':
        return 'testing';
      case 'debugging':
      case 'bug_detection':
        return 'debugging';
      case 'documentation':
      case 'doc_generation':
        return 'documentation';
      case 'coding':
      case 'code_review':
      case 'explanation':
        return 'coding';
      case 'reasoning':
        return 'reasoning';
      case 'general':
      case 'chat':
      default:
        return 'chat';
    }
  }
}
