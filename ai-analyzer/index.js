import 'dotenv/config';
import axios from 'axios';
import logger from './logger.js';
import ClickHouseClient from './clickhouse-client.js';
import AIAnalyzer from './ai-analyzer.js';

class AIAnalyzerService {
  constructor() {
    this.clickhouseClient = new ClickHouseClient(
      process.env.CLICKHOUSE_HOST || 'localhost',
      process.env.CLICKHOUSE_PORT || 9000
    );

    this.aiAnalyzer = new AIAnalyzer(
      process.env.OPENAI_API_KEY,
      process.env.AI_MODEL || 'gpt-4-turbo-preview'
    );

    this.githubServiceUrl = process.env.GITHUB_SERVICE_URL || 'http://localhost:3001';
    this.serviceName = process.env.SERVICE_NAME || 'rightstep-app';
    this.pollingInterval = parseInt(process.env.POLLING_INTERVAL) || 300000;
    this.checkInterval = parseInt(process.env.CHECK_INTERVAL) || 15;
    this.isRunning = false;
    this.processedIssues = new Set();
  }

  async start() {
    logger.info('AI Analyzer Service started', {
      service: this.serviceName,
      interval: `${this.pollingInterval / 1000}s`
    });

    this.validateConfig();
    await this.checkGitHubService();
    this.isRunning = true;
    await this.run();
  }

  validateConfig() {
    const required = ['OPENAI_API_KEY', 'GITHUB_SERVICE_URL'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  async checkGitHubService() {
    try {
      const response = await axios.get(`${this.githubServiceUrl}/health`, {
        timeout: 5000
      });

      if (!response.data.success) {
        throw new Error('GitHub Service is not healthy');
      }
    } catch (error) {
      logger.error('GitHub Service not accessible', {
        error: error.message,
        url: this.githubServiceUrl
      });
      throw new Error('GitHub Service is not accessible. Please ensure it is running.');
    }
  }

  async run() {
    while (this.isRunning) {
      try {
        await this.analyzeAndDetectIssues();
        await this.sleep(this.pollingInterval);
      } catch (error) {
        logger.error('Monitoring cycle error', { error: error.message });
        await this.sleep(60000);
      }
    }
  }

  async analyzeAndDetectIssues() {
    try {
      const errorLogs = await this.clickhouseClient.getErrorLogs(
        this.serviceName,
        this.checkInterval
      );

      if (!errorLogs || !errorLogs.result || !errorLogs.result[0]?.list?.length) {
        return;
      }

      const metrics = await this.clickhouseClient.getServiceMetrics(this.serviceName);
      const analysis = await this.aiAnalyzer.analyzeLogsForIssues(errorLogs, metrics);

      if (analysis.shouldCreateIssue && await this.shouldCreateNewIssue(analysis)) {
        await this.createIssueViaGitHubService(analysis, errorLogs);
      }
    } catch (error) {
      logger.error('Analysis cycle error', { error: error.message });
    }
  }

  async shouldCreateNewIssue(analysis) {
    if (analysis.severity === 'low') {
      return false;
    }

    const issueKey = `${analysis.severity}-${analysis.issueTitle}`;
    if (this.processedIssues.has(issueKey)) {
      return false;
    }

    const hasSimilarIssue = await this.checkForSimilarIssues(analysis.issueTitle);
    if (hasSimilarIssue) {
      logger.info('Similar issue already exists on GitHub', { title: analysis.issueTitle });
      return false;
    }

    return true;
  }

  async checkForSimilarIssues(newTitle) {
    try {
      const response = await axios.get(
        `${this.githubServiceUrl}/api/issues`,
        {
          params: {
            state: 'open',
            labels: 'ai-detected'
          },
          timeout: 10000
        }
      );

      if (!response.data.success || !response.data.issues) {
        return false;
      }

      const existingIssues = response.data.issues;
      const normalizedNewTitle = this.normalizeTitle(newTitle);

      for (const issue of existingIssues) {
        const normalizedExistingTitle = this.normalizeTitle(issue.title);
        const similarity = this.calculateSimilarity(normalizedNewTitle, normalizedExistingTitle);

        if (similarity > 0.7) {
          logger.info('Found similar issue', {
            existingIssue: issue.number,
            existingTitle: issue.title,
            newTitle: newTitle,
            similarity: similarity.toFixed(2)
          });
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Error checking for similar issues', { error: error.message });
      return false;
    }
  }

  normalizeTitle(title) {
    return title
      .toLowerCase()
      .replace(/\[critical\]|\[high\]|\[medium\]|\[low\]/gi, '')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  calculateSimilarity(str1, str2) {
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  async createIssueViaGitHubService(analysis, logs) {
    try {
      const repoUrl = process.env.REPO_URL || 'https://github.com/owner/repo';
      const issueBody = await this.aiAnalyzer.generateGitHubIssueBody(
        analysis,
        logs,
        repoUrl
      );

      const fullIssueBody = `${issueBody}

---

**Auto-generated by AI Analyzer**
- **Severity:** ${analysis.severity}
- **Priority:** ${analysis.suggestedPriority}
- **Detected:** ${new Date().toISOString()}
- **Service:** ${this.serviceName}
- **Error Pattern:** ${analysis.errorPattern}

*This issue was automatically created by the AI monitoring system.*
*An n8n workflow will analyze the codebase and suggest solutions.*`;

      const labels = [
        'ai-detected',
        analysis.severity,
        analysis.suggestedPriority.toLowerCase()
      ];

      const issueTitle = `[${analysis.severity.toUpperCase()}] ${analysis.issueTitle}`;

      const response = await axios.post(
        `${this.githubServiceUrl}/api/issues`,
        {
          title: issueTitle,
          body: fullIssueBody,
          labels,
          checkDuplicate: true
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success && !response.data.duplicate) {
        logger.info('Issue created', {
          number: response.data.issue.number,
          url: response.data.issue.url
        });

        const issueKey = `${analysis.severity}-${analysis.issueTitle}`;
        this.processedIssues.add(issueKey);

        setTimeout(() => {
          this.processedIssues.delete(issueKey);
        }, 7200000);
      }
    } catch (error) {
      logger.error('Issue creation failed', {
        error: error.message
      });
      throw error;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    logger.info('Stopping AI Analyzer Service...');
    this.isRunning = false;
  }
}

const service = new AIAnalyzerService();

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  service.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  service.stop();
  process.exit(0);
});

service.start().catch(error => {
  logger.error('Fatal error starting service', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});
