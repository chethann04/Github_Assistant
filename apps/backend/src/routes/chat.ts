import { Router, Request, Response } from 'express';
import { RAGService, ChatMode } from '../services/rag.service.js';
import { LLMService, LLMProviderType } from '../services/llm.service.js';
import prisma from '../config/prisma.js';

const router = Router();

// GET /api/v1/chat/providers — check available AI providers (Gemini, OpenAI, Dual)
router.get('/providers', (req: Request, res: Response) => {
  const providers = LLMService.getAvailableProviders();
  res.json(providers);
});

// POST /api/v1/chat/stream — SSE streaming chat (enforces session ownership & multi-model support)
router.post('/stream', async (req: Request, res: Response) => {
  const { query, repositoryId, chatSessionId, mode = 'repo', selectedFilePath, provider } = req.body;
  const sessionId = req.anonymousSession.id;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'query is required.' });
  }
  if (!repositoryId || typeof repositoryId !== 'string') {
    return res.status(400).json({ error: 'repositoryId is required.' });
  }

  // Verify repository belongs to current anonymous session
  const repo = await prisma.repository.findFirst({
    where: { id: repositoryId, sessionId },
  });
  if (!repo) {
    return res.status(404).json({ error: 'Repository not found' });
  }

  // If chatSessionId is provided, verify it belongs to current session and repo
  if (chatSessionId) {
    const chatSession = await prisma.chatSession.findFirst({
      where: { id: chatSessionId, repositoryId, sessionId },
    });
    if (!chatSession) {
      return res.status(404).json({ error: 'Chat session not found' });
    }
  }

  const validModes: ChatMode[] = ['repo', 'file', 'debug', 'architecture', 'commits'];
  const chatMode: ChatMode = validModes.includes(mode) ? mode : 'repo';
  const selectedProvider: LLMProviderType | undefined = ['gemini', 'openai', 'dual', 'auto'].includes(provider)
    ? provider
    : undefined;

  // SSE headers with credentials support
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  let clientDisconnected = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      clientDisconnected = true;
    }
  });

  try {
    const stream = RAGService.streamResponse(
      query,
      repositoryId,
      chatSessionId || undefined,
      chatMode,
      selectedFilePath || undefined,
      selectedProvider
    );

    for await (const chunk of stream) {
      if (clientDisconnected) break;
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      if (typeof (res as any).flush === 'function') (res as any).flush();
    }

    if (!clientDisconnected) {
      res.write('data: [DONE]\n\n');
      if (typeof (res as any).flush === 'function') (res as any).flush();
    }
    res.end();
  } catch (err: any) {
    console.error('[ChatRoute] Stream error:', err.message);
    if (!clientDisconnected) {
      res.write(`data: ${JSON.stringify({ type: 'error', data: { message: 'Failed to generate response' } })}\n\n`);
    }
    res.end();
  }
});

// POST /api/v1/chat/sessions — create a new chat session owned by current session
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { repositoryId, title = 'New Chat', mode = 'repo', selectedFile } = req.body;
    const sessionId = req.anonymousSession.id;

    if (!repositoryId) return res.status(400).json({ error: 'repositoryId is required' });

    // Verify repository belongs to current session
    const repo = await prisma.repository.findFirst({
      where: { id: repositoryId, sessionId },
    });
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const session = await prisma.chatSession.create({
      data: {
        sessionId,
        repositoryId,
        title,
        mode,
        selectedFile: selectedFile || null,
      },
    });

    return res.status(201).json(session);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/chat/:repoId/sessions — list sessions for a repository (enforces session ownership)
router.get('/:repoId/sessions', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repoId } = req.params;

    // Verify repository belongs to current session
    const repo = await prisma.repository.findFirst({
      where: { id: repoId, sessionId },
    });
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const sessions = await prisma.chatSession.findMany({
      where: {
        repositoryId: repoId,
        sessionId,
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, role: true, createdAt: true },
        },
      },
    });
    return res.json(sessions);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/chat/sessions/:sessionId — get a specific session with messages (enforces ownership)
router.get('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const session = await prisma.chatSession.findFirst({
      where: {
        id: req.params.sessionId,
        sessionId,
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!session) return res.status(404).json({ error: 'Session not found' });
    return res.json(session);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/chat/sessions/:sessionId — rename session (enforces ownership)
router.patch('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { title } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }

    const existing = await prisma.chatSession.findFirst({
      where: { id: req.params.sessionId, sessionId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = await prisma.chatSession.update({
      where: { id: existing.id },
      data: { title: title.trim().slice(0, 100) },
    });
    return res.json(session);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/chat/sessions/:sessionId — delete session (enforces ownership)
router.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const existing = await prisma.chatSession.findFirst({
      where: { id: req.params.sessionId, sessionId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await prisma.chatSession.delete({ where: { id: existing.id } });
    return res.json({ message: 'Session deleted' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/chat/:repoId/search — semantic code search (enforces session ownership)
router.post('/:repoId/search', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repoId } = req.params;
    const { query, limit = 8 } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    // Verify repository belongs to current session
    const repo = await prisma.repository.findFirst({
      where: { id: repoId, sessionId },
    });
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    const { citations, error } = await RAGService.retrieveContext(query, repo.id, limit);
    if (error) {
      return res.status(500).json({ error });
    }
    return res.json(citations);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
