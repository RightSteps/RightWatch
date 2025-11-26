import { Octokit } from '@octokit/rest';
import logger from './logger.js';

class GitHubClient {
  constructor(token, owner, repo) {
    this.octokit = new Octokit({ auth: token });
    this.owner = owner;
    this.repo = repo;
  }

  async createIssue(title, body, labels = ['ai-detected', 'bug']) {
    try {
      logger.info('Creating GitHub issue', { title, labels });

      const response = await this.octokit.issues.create({
        owner: this.owner,
        repo: this.repo,
        title,
        body,
        labels
      });

      logger.info('GitHub issue created successfully', {
        issueNumber: response.data.number,
        issueUrl: response.data.html_url
      });

      return {
        success: true,
        issue: {
          number: response.data.number,
          url: response.data.html_url,
          id: response.data.id,
          title: response.data.title,
          state: response.data.state,
          createdAt: response.data.created_at
        }
      };
    } catch (error) {
      logger.error('Error creating GitHub issue', {
        error: error.message,
        status: error.status
      });
      throw error;
    }
  }

  async checkExistingIssue(title) {
    try {
      logger.info('Checking for existing issues', { title });

      const response = await this.octokit.issues.listForRepo({
        owner: this.owner,
        repo: this.repo,
        state: 'open',
        per_page: 100,
        sort: 'created',
        direction: 'desc'
      });

      const existingIssue = response.data.find(issue => {
        const issueTitle = issue.title.toLowerCase();
        const searchTitle = title.toLowerCase();
        return issueTitle.includes(searchTitle) || searchTitle.includes(issueTitle);
      });

      if (existingIssue) {
        logger.info('Found existing similar issue', {
          issueNumber: existingIssue.number,
          issueTitle: existingIssue.title
        });
        return {
          exists: true,
          issue: {
            number: existingIssue.number,
            url: existingIssue.html_url,
            title: existingIssue.title
          }
        };
      }

      logger.info('No existing similar issue found');
      return { exists: false };
    } catch (error) {
      logger.error('Error checking existing issues', { error: error.message });
      throw error;
    }
  }

  async addComment(issueNumber, comment) {
    try {
      logger.info('Adding comment to issue', { issueNumber });

      const response = await this.octokit.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        body: comment
      });

      logger.info('Comment added successfully', {
        issueNumber,
        commentId: response.data.id
      });

      return {
        success: true,
        comment: {
          id: response.data.id,
          url: response.data.html_url
        }
      };
    } catch (error) {
      logger.error('Error adding comment', {
        error: error.message,
        issueNumber
      });
      throw error;
    }
  }

  async closeIssue(issueNumber, comment = null) {
    try {
      logger.info('Closing issue', { issueNumber });

      if (comment) {
        await this.addComment(issueNumber, comment);
      }

      const response = await this.octokit.issues.update({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        state: 'closed'
      });

      logger.info('Issue closed successfully', { issueNumber });

      return {
        success: true,
        issue: {
          number: response.data.number,
          state: response.data.state
        }
      };
    } catch (error) {
      logger.error('Error closing issue', {
        error: error.message,
        issueNumber
      });
      throw error;
    }
  }

  async listIssues(state = 'open', labels = null) {
    try {
      const params = {
        owner: this.owner,
        repo: this.repo,
        state,
        per_page: 50,
        sort: 'created',
        direction: 'desc'
      };

      if (labels) {
        params.labels = labels;
      }

      const response = await this.octokit.issues.listForRepo(params);

      return {
        success: true,
        issues: response.data.map(issue => ({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          url: issue.html_url,
          labels: issue.labels.map(l => l.name),
          createdAt: issue.created_at,
          updatedAt: issue.updated_at
        }))
      };
    } catch (error) {
      logger.error('Error listing issues', { error: error.message });
      throw error;
    }
  }
}

export default GitHubClient;
