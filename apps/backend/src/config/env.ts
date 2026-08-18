import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const candidateDirs = [
  process.cwd(),
  path.resolve(process.cwd(), '..'),
  path.resolve(process.cwd(), '../..'),
  typeof __dirname !== 'undefined' ? __dirname : '',
  typeof __dirname !== 'undefined' ? path.resolve(__dirname, '..') : '',
  typeof __dirname !== 'undefined' ? path.resolve(__dirname, '../..') : '',
  typeof __dirname !== 'undefined' ? path.resolve(__dirname, '../../..') : '',
].filter(Boolean);

for (const dir of candidateDirs) {
  const envPath = path.join(dir, '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}
dotenv.config();

const geminiKey = process.env.GEMINI_API_KEY || '';

// Provider resolution: 'nvidia' | 'openrouter' | 'dual' | 'openai'
const rawProvider = (process.env.LLM_PROVIDER || '').trim().toLowerCase();
const resolvedProvider = rawProvider === 'openrouter'
  ? 'openrouter'
  : rawProvider === 'gemini'
  ? 'gemini'
  : rawProvider === 'dual'
  ? 'dual'
  : rawProvider === 'openai'
  ? 'openai'
  : 'nvidia'; // default to nvidia

const isNvidia = resolvedProvider === 'nvidia';
const isOpenRouter = resolvedProvider === 'openrouter';

// Resolve GLM Model
const glmModel = process.env.GLM_MODEL || process.env.NVIDIA_MODEL || process.env.OPENAI_MODEL || 'z-ai/glm-5.2';

// Resolve API Key and Base URL based on selected provider
let resolvedApiKey = '';
let resolvedBaseUrl = '';

if (isOpenRouter) {
  resolvedApiKey = process.env.OPENROUTER_API_KEY || '';
  resolvedBaseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  if (!resolvedApiKey) {
    console.warn('[Config] Warning: LLM_PROVIDER is set to "openrouter" but OPENROUTER_API_KEY is not set.');
  }
} else if (isNvidia) {
  resolvedApiKey = process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY || '';
  resolvedBaseUrl = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
  if (!resolvedApiKey) {
    console.warn('[Config] Warning: LLM_PROVIDER is set to "nvidia" but NVIDIA_API_KEY is not set.');
  }
} else {
  // Generic OpenAI or other provider
  resolvedApiKey = process.env.OPENAI_API_KEY || '';
  resolvedBaseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
}

const rawEmbeddingDims = parseInt(process.env.EMBEDDING_DIMENSIONS || '2048', 10);
const embeddingDimensions = isNaN(rawEmbeddingDims) || rawEmbeddingDims <= 0 ? 2048 : rawEmbeddingDims;

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  directUrl: process.env.DIRECT_URL || '',
  chromaPersistDirectory: process.env.CHROMA_PERSIST_DIRECTORY || './data/chroma',
  chromaCollectionName: process.env.CHROMA_COLLECTION_NAME || 'repo_chunks_2048',
  llmProvider: resolvedProvider,
  glmModel,
  geminiApiKey: geminiKey,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  openaiApiKey: resolvedApiKey,
  openaiModel: glmModel,
  openaiBaseUrl: resolvedBaseUrl,
  nvidiaApiKey: process.env.NVIDIA_API_KEY || '',
  nvidiaBaseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openrouterBaseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  isNvidiaProvider: isNvidia,
  isOpenRouterProvider: isOpenRouter,
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

