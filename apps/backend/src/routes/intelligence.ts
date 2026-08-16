import { Router, Request, Response } from 'express';
import { IntelligenceService } from '../services/intelligence.service.js';
import { DependencyGraphService } from '../services/dependency-graph.service.js';
import prisma from '../config/prisma.js';

const router = Router();

// POST /api/v1/intelligence/:repoId/architecture (enforces session ownership)
router.post('/:repoId/architecture', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.repoId, sessionId },
    });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    const architecture = await IntelligenceService.generateArchitecture(repo.id);
    return res.json({ architecture });
  } catch (err: any) {
    return res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});

// POST /api/v1/intelligence/:repoId/docs (enforces session ownership)
router.post('/:repoId/docs', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.repoId, sessionId },
    });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    const { docType = 'readme' } = req.body;
    if (!['readme', 'api', 'docstrings'].includes(docType)) {
      return res.status(400).json({ error: 'docType must be readme, api, or docstrings' });
    }
    const docs = await IntelligenceService.generateDocs(repo.id, docType as 'readme' | 'api' | 'docstrings');
    return res.json({ docs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/intelligence/:repoId/bugs (enforces session ownership)
router.post('/:repoId/bugs', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.repoId, sessionId },
    });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    const bugs = await IntelligenceService.detectBugs(repo.id);
    return res.json(bugs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/intelligence/:repoId/security (enforces session ownership)
router.post('/:repoId/security', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.repoId, sessionId },
    });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    const findings = await IntelligenceService.scanSecurity(repo.id);
    return res.json(findings);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/intelligence/:repoId/commits (enforces session ownership)
router.get('/:repoId/commits', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.repoId, sessionId },
    });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    const data = await IntelligenceService.fetchCommitHistory(repo.owner, repo.name);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/intelligence/:repoId/explain (enforces session ownership)
router.post('/:repoId/explain', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.repoId, sessionId },
    });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    const { filePath, snippet } = req.body;
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'filePath is required' });
    }
    if (!snippet || typeof snippet !== 'string') {
      return res.status(400).json({ error: 'snippet is required' });
    }

    const explanation = await IntelligenceService.explainCode(repo.id, filePath, snippet);
    return res.json({ explanation });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/intelligence/:repoId/impact (enforces session ownership)
router.post('/:repoId/impact', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.repoId, sessionId },
    });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    const { filePath } = req.body;
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'filePath is required' });
    }

    const impact = await IntelligenceService.analyzeImpact(repo.id, filePath);
    return res.json(impact);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/intelligence/:repoId/health (enforces session ownership)
router.get('/:repoId/health', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.repoId, sessionId },
    });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    const health = await IntelligenceService.calculateHealthScore(repo.id);
    return res.json(health);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/intelligence/:repoId/dependency-graph (enforces session ownership)
router.get('/:repoId/dependency-graph', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.repoId, sessionId },
    });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    const graph = await DependencyGraphService.buildGraph(repo.id);
    return res.json(graph);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/intelligence/:repoId/dependency-details (enforces session ownership)
router.post('/:repoId/dependency-details', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.repoId, sessionId },
    });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    const { filePath } = req.body;
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'filePath is required' });
    }

    const details = await DependencyGraphService.getFileDetails(repo.id, filePath);
    return res.json(details);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/intelligence/:repoId/generate-tests (enforces session ownership)
router.post('/:repoId/generate-tests', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.repoId, sessionId },
    });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    const { filePath, framework = 'vitest' } = req.body;
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'filePath is required' });
    }

    const testSuite = await IntelligenceService.generateTests(repo.id, filePath, framework);
    return res.json({ testSuite });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/intelligence/compare — compare two repositories side-by-side
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repoId1, repoId2 } = req.body;

    if (!repoId1 || !repoId2) {
      return res.status(400).json({ error: 'repoId1 and repoId2 are required' });
    }

    const [repo1, repo2] = await Promise.all([
      prisma.repository.findFirst({ where: { id: repoId1, sessionId } }),
      prisma.repository.findFirst({ where: { id: repoId2, sessionId } }),
    ]);

    if (!repo1 || !repo2) {
      return res.status(404).json({ error: 'One or both repositories not found' });
    }

    const [health1, health2] = await Promise.all([
      IntelligenceService.calculateHealthScore(repo1.id),
      IntelligenceService.calculateHealthScore(repo2.id),
    ]);

    return res.json({
      repo1: {
        id: repo1.id,
        name: repo1.name,
        owner: repo1.owner,
        language: repo1.language,
        stars: repo1.stars,
        forks: repo1.forks,
        health: health1,
      },
      repo2: {
        id: repo2.id,
        name: repo2.name,
        owner: repo2.owner,
        language: repo2.language,
        stars: repo2.stars,
        forks: repo2.forks,
        health: health2,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
