import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import logger from './logger.js';
import GitHubClient from './github-client.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let githubClient;

function initializeGitHubClient() {
  try {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    if (!token || !owner || !repo) {
      throw new Error('Missing required environment variables: GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO');
    }

    githubClient = new GitHubClient(token, owner, repo);
    logger.info('GitHub client initialized', { owner, repo });
  } catch (error) {
    logger.error('Failed to initialize GitHub client', { error: error.message });
    throw error;
  }
}

app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'github-service',
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.post('/api/issues', async (req, res) => {
  try {
    const { title, body, labels, checkDuplicate = true } = req.body;

    if (!title || !body) {
      logger.warn('Invalid request: missing title or body');
      return res.status(400).json({
        success: false,
        error: 'Title and body are required'
      });
    }

    logger.info('Received issue creation request', { title, labels });

    if (checkDuplicate) {
      const existingCheck = await githubClient.checkExistingIssue(title);
      if (existingCheck.exists) {
        logger.info('Duplicate issue detected, skipping creation', {
          existingIssue: existingCheck.issue.number
        });
        return res.status(200).json({
          success: true,
          duplicate: true,
          message: 'Similar issue already exists',
          existingIssue: existingCheck.issue
        });
      }
    }

    const result = await githubClient.createIssue(title, body, labels);

    res.status(201).json(result);
  } catch (error) {
    logger.error('Error creating issue', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Failed to create GitHub issue',
      message: error.message
    });
  }
});

app.post('/api/issues/:number/comments', async (req, res) => {
  try {
    const { number } = req.params;
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({
        success: false,
        error: 'Comment is required'
      });
    }

    const issueNumber = parseInt(number);
    if (isNaN(issueNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid issue number'
      });
    }

    const result = await githubClient.addComment(issueNumber, comment);
    res.status(201).json(result);
  } catch (error) {
    logger.error('Error adding comment', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to add comment',
      message: error.message
    });
  }
});

app.patch('/api/issues/:number/close', async (req, res) => {
  try {
    const { number } = req.params;
    const { comment } = req.body;

    const issueNumber = parseInt(number);
    if (isNaN(issueNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid issue number'
      });
    }

    const result = await githubClient.closeIssue(issueNumber, comment);
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error closing issue', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to close issue',
      message: error.message
    });
  }
});

app.get('/api/issues', async (req, res) => {
  try {
    const { state = 'open', labels } = req.query;
    const result = await githubClient.listIssues(state, labels);
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error listing issues', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to list issues',
      message: error.message
    });
  }
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url
  });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

try {
  initializeGitHubClient();

  app.listen(port, () => {
    logger.info(`GitHub Service running on port ${port}`, {
      port,
      env: process.env.NODE_ENV || 'development'
    });
  });
} catch (error) {
  logger.error('Failed to start GitHub Service', { error: error.message });
  process.exit(1);
}

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
