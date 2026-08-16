import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const geminiKey = process.env.GEMINI_API_KEY || '';
const rawOpenaiKey = process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY || '';
const isNvidiaKey = rawOpenaiKey.startsWith('nvapi-') || Boolean(process.env.NVIDIA_API_KEY);

const defaultOpenaiBaseUrl = isNvidiaKey
  ? 'https://integrate.api.nvidia.com/v1'
  : undefined;

const openaiBaseUrl = process.env.NVIDIA_BASE_URL || process.env.OPENAI_BASE_URL || defaultOpenaiBaseUrl;
const defaultModel = isNvidiaKey ? (process.env.NVIDIA_MODEL || 'z-ai/glm-5.2') : 'gpt-4o-mini';
const openaiModel = process.env.NVIDIA_MODEL || process.env.OPENAI_MODEL || defaultModel;

const rawEmbeddingDims = parseInt(process.env.EMBEDDING_DIMENSIONS || '2048', 10);
const embeddingDimensions = isNaN(rawEmbeddingDims) || rawEmbeddingDims <= 0 ? 2048 : rawEmbeddingDims;

const defaultLLMProvider = isNvidiaKey ? 'nvidia' : (process.env.LLM_PROVIDER || 'dual');
const llmProvider = process.env.LLM_PROVIDER || defaultLLMProvider;

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  directUrl: process.env.DIRECT_URL || '',
  chromaPersistDirectory: process.env.CHROMA_PERSIST_DIRECTORY || './data/chroma',
  chromaCollectionName: process.env.CHROMA_COLLECTION_NAME || 'repo_chunks_2048',
  llmProvider,
  geminiApiKey: geminiKey,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  openaiApiKey: rawOpenaiKey,
  openaiModel,
  openaiBaseUrl,
  nvidiaApiKey: process.env.NVIDIA_API_KEY || rawOpenaiKey,
  nvidiaBaseUrl: process.env.NVIDIA_BASE_URL || defaultOpenaiBaseUrl || 'https://integrate.api.nvidia.com/v1',
  isNvidiaProvider: isNvidiaKey || Boolean(openaiBaseUrl?.includes('nvidia.com')),
  chatModel: process.env.GEMINI_MODEL || process.env.CHAT_MODEL || 'gemini-2.5-flash',
  embeddingModel: process.env.EMBEDDING_MODEL || 'nvidia/nemotron-3-embed-1b',
  embeddingDimensions,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  githubToken: process.env.GITHUB_TOKEN || '',
  maxFilesToIndex: parseInt(process.env.MAX_FILES_TO_INDEX || '300', 10),
  topKResults: parseInt(process.env.TOP_K_RESULTS || '8', 10),
  maxContextMessages: parseInt(process.env.MAX_CONTEXT_MESSAGES || '10', 10),
  enableInMemoryFallback: process.env.ENABLE_IN_MEMORY_VECTOR_FALLBACK === 'true',
  enableDeterministicEmbeddingFallback: process.env.ENABLE_DETERMINISTIC_EMBEDDING_FALLBACK === 'true',
};
