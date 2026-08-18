import { Router, Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { GitMapAnalyzerService } from '../services/gitmap/gitmap-analyzer.service.js';
import { GitMapAIService } from '../services/gitmap/gitmap-ai.service.js';

const router = Router();

// Helper to ensure repository belongs to current anonymous session
async function verifyRepoOwnership(repoId: string, sessionId: string) {
  const repo = await prisma.repository.findFirst({
    where: { id: repoId, sessionId },
  });
  if (!repo) {
    throw new Error('Repository not found or access denied');
  }
  return repo;
}

// POST /api/v1/gitmap/:repoId/analyze — Trigger/run deterministic Stage A analysis
router.post('/:repoId/analyze', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repoId } = req.params;
    const force = Boolean(req.body?.force);

    await verifyRepoOwnership(repoId, sessionId);
    const graph = await GitMapAnalyzerService.runAnalysis(repoId, sessionId, force);

    return res.json(graph);
  } catch (err: any) {
    console.error('[GitMapRoute] Analyze error:', err.message);
    return res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});

// GET /api/v1/gitmap/:repoId/map — Get full interactive graph data
router.get('/:repoId/map', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repoId } = req.params;
    const force = req.query.force === 'true';

    await verifyRepoOwnership(repoId, sessionId);
    let graph = force ? null : await GitMapAnalyzerService.getAnalysis(repoId);

    // Auto-run if not yet analyzed or forced
    if (!graph) {
      graph = await GitMapAnalyzerService.runAnalysis(repoId, sessionId, force);
    }

    return res.json(graph);
  } catch (err: any) {
    console.error('[GitMapRoute] Map fetch error:', err.message);
    return res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});

// GET /api/v1/gitmap/:repoId/overview — High-level architecture overview
router.get('/:repoId/overview', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repoId } = req.params;

    await verifyRepoOwnership(repoId, sessionId);
    const graph = await GitMapAnalyzerService.getAnalysis(repoId);
    if (!graph) {
      return res.status(404).json({ error: 'GitMap analysis not found. Run analysis first.' });
    }

    return res.json({
      repositoryId: graph.repositoryId,
      stats: graph.stats,
      overviewSummary: graph.overviewSummary || 'Architecture synthesis in progress.',
      topModules: graph.modules.slice(0, 6),
      health: graph.health,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/gitmap/:repoId/modules — List detected modules
router.get('/:repoId/modules', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repoId } = req.params;

    await verifyRepoOwnership(repoId, sessionId);
    const graph = await GitMapAnalyzerService.getAnalysis(repoId);
    if (!graph) return res.status(404).json({ error: 'Analysis not found' });

    return res.json(graph.modules);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/gitmap/:repoId/files — List file nodes with scores
router.get('/:repoId/files', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repoId } = req.params;

    await verifyRepoOwnership(repoId, sessionId);
    const graph = await GitMapAnalyzerService.getAnalysis(repoId);
    if (!graph) return res.status(404).json({ error: 'Analysis not found' });

    return res.json(graph.nodes);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/gitmap/:repoId/dependencies — List manifest dependencies
router.get('/:repoId/dependencies', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repoId } = req.params;

    await verifyRepoOwnership(repoId, sessionId);
    const graph = await GitMapAnalyzerService.getAnalysis(repoId);
    if (!graph) return res.status(404).json({ error: 'Analysis not found' });

    return res.json(graph.dependencies);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/gitmap/:repoId/git-activity — Hotspots & git churn
router.get('/:repoId/git-activity', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repoId } = req.params;

    await verifyRepoOwnership(repoId, sessionId);
    const graph = await GitMapAnalyzerService.getAnalysis(repoId);
    if (!graph) return res.status(404).json({ error: 'Analysis not found' });

    return res.json(graph.gitActivity);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/gitmap/:repoId/contributors — Contributor ownership & bus-factor
router.get('/:repoId/contributors', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repoId } = req.params;

    await verifyRepoOwnership(repoId, sessionId);
    const graph = await GitMapAnalyzerService.getAnalysis(repoId);
    if (!graph) return res.status(404).json({ error: 'Analysis not found' });

    return res.json({
      contributors: graph.contributors,
      busFactorRisks: graph.gitActivity.contributorConcentrationRisk,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/gitmap/:repoId/risk — High risk files & modules
router.get('/:repoId/risk', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repoId } = req.params;

    await verifyRepoOwnership(repoId, sessionId);
    const graph = await GitMapAnalyzerService.getAnalysis(repoId);
    if (!graph) return res.status(404).json({ error: 'Analysis not found' });

    const highRiskNodes = graph.nodes.filter((n) => n.riskLevel === 'CRITICAL' || n.riskLevel === 'HIGH');
    const highRiskModules = graph.modules.filter((m) => m.riskLevel === 'CRITICAL' || m.riskLevel === 'HIGH');

    return res.json({
      highRiskFiles: highRiskNodes,
      highRiskModules: highRiskModules,
      technicalDebt: graph.technicalDebt,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/gitmap/:repoId/health — Health score & technical debt breakdown
router.get('/:repoId/health', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repoId } = req.params;

    await verifyRepoOwnership(repoId, sessionId);
    const graph = await GitMapAnalyzerService.getAnalysis(repoId);
    if (!graph) return res.status(404).json({ error: 'Analysis not found' });

    return res.json({
      health: graph.health,
      technicalDebt: graph.technicalDebt,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/gitmap/:repoId/onboarding — "Start Here" reading guide for developers
router.get('/:repoId/onboarding', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repoId } = req.params;

    await verifyRepoOwnership(repoId, sessionId);
    const graph = await GitMapAnalyzerService.getAnalysis(repoId);
    if (!graph) return res.status(404).json({ error: 'Analysis not found' });

    return res.json({
      onboardingGuide: graph.onboardingGuide || [],
      entryPoints: graph.nodes.filter((n) => n.isEntryPoint),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/gitmap/:repoId/ask — "How does this work?" Q&A with traceable graph path
router.post('/:repoId/ask', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repoId } = req.params;
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query string is required' });
    }

    await verifyRepoOwnership(repoId, sessionId);
    let graph = await GitMapAnalyzerService.getAnalysis(repoId);
    if (!graph) {
      graph = await GitMapAnalyzerService.runAnalysis(repoId, sessionId, false);
    }

    const answer = await GitMapAIService.answerHowItWorks(graph, query);
    return res.json(answer);
  } catch (err: any) {
    console.error('[GitMapRoute] Ask error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/gitmap/:repoId/impact — Deep graph blast radius impact analysis
router.post('/:repoId/impact', async (req: Request, res: Response) => {
  try {
    const sessionId = req.anonymousSession.id;
    const { repoId } = req.params;
    const { filePath } = req.body;

    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'filePath string is required' });
    }

    await verifyRepoOwnership(repoId, sessionId);
    let graph = await GitMapAnalyzerService.getAnalysis(repoId);
    if (!graph) {
      graph = await GitMapAnalyzerService.runAnalysis(repoId, sessionId, false);
    }

    const impact = await GitMapAIService.analyzeImpact(graph, filePath);
    return res.json(impact);
  } catch (err: any) {
    console.error('[GitMapRoute] Impact error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
