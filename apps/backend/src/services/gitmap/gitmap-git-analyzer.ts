import { GitHubService, CommitInfo } from '../github.service.js';
import { GitActivityData, GitContributorStats } from './gitmap.types.js';

export interface FileGitMetrics {
  filePath: string;
  commitCount: number;
  lastModified: string;
  topContributor: string;
  contributorCount: number;
  contributors: Array<{ name: string; commits: number; percentage: number }>;
  isHotspot: boolean;
}

export class GitMapGitAnalyzer {
  public static async analyzeGitHistory(
    owner: string,
    name: string
  ): Promise<{
    fileMetricsMap: Map<string, FileGitMetrics>;
    activityData: GitActivityData;
    contributorStats: GitContributorStats[];
  }> {
    const fileMetricsMap = new Map<string, FileGitMetrics>();
    const fileCommitCounts = new Map<string, number>();
    const fileLastModified = new Map<string, string>();
    const fileAuthorCounts = new Map<string, Map<string, number>>();
    const globalAuthorCommits = new Map<string, number>();
    const globalAuthorFiles = new Map<string, Set<string>>();

    let commits: CommitInfo[] = [];
    try {
      commits = await GitHubService.fetchCommits(owner, name, 60);
    } catch (err: any) {
      console.warn(`[GitMapGitAnalyzer] Warning: could not fetch commits for ${owner}/${name}:`, err.message);
    }

    // Process each commit & inspect detailed file changes if available
    const detailedCommitsSample = commits.slice(0, 10);
    await Promise.allSettled(
      detailedCommitsSample.map(async (c) => {
        try {
          const detail = await GitHubService.fetchCommitDetail(owner, name, c.sha);
          const author = detail.commit.author || 'Unknown';
          const date = detail.commit.date || new Date().toISOString();

          globalAuthorCommits.set(author, (globalAuthorCommits.get(author) || 0) + 1);

          for (const file of detail.files) {
            const filePath = file.path;
            fileCommitCounts.set(filePath, (fileCommitCounts.get(filePath) || 0) + 1);

            if (!fileLastModified.has(filePath)) {
              fileLastModified.set(filePath, date);
            }

            if (!fileAuthorCounts.has(filePath)) {
              fileAuthorCounts.set(filePath, new Map());
            }
            const authorMap = fileAuthorCounts.get(filePath)!;
            authorMap.set(author, (authorMap.get(author) || 0) + 1);

            if (!globalAuthorFiles.has(author)) {
              globalAuthorFiles.set(author, new Set());
            }
            globalAuthorFiles.get(author)!.add(filePath);
          }
        } catch {
          // ignore single commit fetch error
        }
      })
    );

    // Build per-file metrics
    const sortedFileCommits = Array.from(fileCommitCounts.entries()).sort((a, b) => b[1] - a[1]);
    const hotspotThreshold = sortedFileCommits.length > 0 ? sortedFileCommits[Math.min(5, sortedFileCommits.length - 1)][1] : 2;

    for (const [filePath, count] of fileCommitCounts.entries()) {
      const authorMap = fileAuthorCounts.get(filePath) || new Map();
      const totalFileCommits = Array.from(authorMap.values()).reduce((a, b) => a + b, 0) || 1;

      const authorList = Array.from(authorMap.entries())
        .map(([authName, authCommits]) => ({
          name: authName,
          commits: authCommits,
          percentage: Math.round((authCommits / totalFileCommits) * 100),
        }))
        .sort((a, b) => b.commits - a.commits);

      const topContributor = authorList[0]?.name || 'Unknown';
      const isHotspot = count >= hotspotThreshold && count >= 2;

      fileMetricsMap.set(filePath, {
        filePath,
        commitCount: count,
        lastModified: fileLastModified.get(filePath) || new Date().toISOString(),
        topContributor,
        contributorCount: authorList.length,
        contributors: authorList,
        isHotspot,
      });
    }

    // Build Hotspots list
    const hotspots = sortedFileCommits.slice(0, 10).map(([filePath, count]) => {
      const metrics = fileMetricsMap.get(filePath);
      return {
        filePath,
        commitCount: count,
        churnScore: Math.min(100, count * 15),
        contributorsCount: metrics?.contributorCount || 1,
        lastModified: metrics?.lastModified || new Date().toISOString(),
      };
    });

    // Build Recent changes list
    const recentChanges = Array.from(fileLastModified.entries())
      .map(([filePath, lastModified]) => ({
        filePath,
        lastModified,
      }))
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
      .slice(0, 12);

    // Build global contributor stats
    const totalGlobalCommits = Array.from(globalAuthorCommits.values()).reduce((a, b) => a + b, 0) || 1;
    const contributorStats: GitContributorStats[] = Array.from(globalAuthorCommits.entries())
      .map(([name, cCount]) => ({
        name,
        commits: cCount,
        percentage: Math.round((cCount / totalGlobalCommits) * 100),
        primaryModules: [],
        activeFilesCount: globalAuthorFiles.get(name)?.size || 0,
      }))
      .sort((a, b) => b.commits - a.commits);

    // Contributor concentration risk evaluation
    const contributorConcentrationRisk: GitActivityData['contributorConcentrationRisk'] = [];
    if (contributorStats.length > 0 && contributorStats[0].percentage >= 70) {
      contributorConcentrationRisk.push({
        moduleName: 'Repository Core',
        primaryContributor: contributorStats[0].name,
        percentage: contributorStats[0].percentage,
        risk: contributorStats[0].percentage >= 85 ? 'HIGH' : 'MODERATE',
        recommendation: `High contribution concentration detected (~${contributorStats[0].percentage}% by ${contributorStats[0].name}). Consider pairing or multi-reviewer workflows on core modules.`,
      });
    }

    const activityData: GitActivityData = {
      totalCommitsAnalyzed: commits.length,
      hotspots,
      recentChanges,
      longUnmodifiedFiles: [],
      contributorConcentrationRisk,
    };

    return {
      fileMetricsMap,
      activityData,
      contributorStats,
    };
  }
}
