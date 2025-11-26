import OpenAI from 'openai';

class AIAnalyzer {
  constructor(apiKey, model = 'gpt-4-turbo-preview') {
    this.openai = new OpenAI({ apiKey });
    this.model = model;
  }

  async analyzeLogsForIssues(logs, metrics = null) {
    try {
      const logsContext = this.formatLogsForAnalysis(logs);
      const metricsContext = metrics ? this.formatMetricsForAnalysis(metrics) : 'No metrics available';

      const prompt = `You are an expert SRE analyzing production application logs from SigNoz monitoring system.

**Logs Data:**
${logsContext}

**Metrics Data:**
${metricsContext}

**Your Task:**
Analyze the logs to identify critical issues requiring immediate attention. Focus on:
1. Error frequency and patterns (multiple errors in short timeframe = critical)
2. Specific error messages and their technical context
3. Impact on application functionality
4. Root cause hypotheses based on error messages
5. Actionable recommendations for developers

**Criteria for creating an issue:**
- 3+ error logs in 15 minutes = HIGH severity
- 5+ error logs in 15 minutes = CRITICAL severity
- Repeated same error = Pattern issue
- Different errors = Systemic issue
- Application/endpoint failures = P0 priority

**IMPORTANT:**
- Ignore test errors like "test error", "Direct OTEL API test"
- Focus on real application errors with stack traces, exceptions, or failures
- Provide specific, actionable root cause analysis
- Identify affected endpoints/features from error context

**Response Format (JSON only):**
{
  "shouldCreateIssue": true/false,
  "severity": "critical/high/medium/low",
  "issueTitle": "Specific, actionable title (e.g. 'Database Connection Pool Exhausted')",
  "issueDescription": "Clear description with business impact and technical details",
  "errorPattern": "Specific pattern identified (e.g. 'Connection timeout to PostgreSQL every 2 minutes')",
  "affectedEndpoints": ["specific endpoints like /api/users, /checkout"],
  "suggestedPriority": "P0/P1/P2/P3",
  "rootCauseHypothesis": "Technical hypothesis with reasoning (e.g. 'Database connection pool too small - 503 errors during peak load')",
  "recommendation": "Specific action items (e.g. 'Increase DB pool size from 10 to 50, add connection timeout monitoring')"
}

Respond ONLY with valid JSON, no additional text.`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      return analysis;
    } catch (error) {
      console.error('Error analyzing logs with AI:', error.message);
      throw error;
    }
  }

  async generateGitHubIssueBody(analysis, logs, repoUrl) {
    try {
      const sampleLogs = this.formatLogsForDisplay(logs, 10);
      const errorCount = logs.result?.[0]?.list?.length || 0;
      const timeRange = this.getTimeRange(logs);

      const endpoints = analysis.affectedEndpoints?.length > 0
        ? analysis.affectedEndpoints.join(', ')
        : 'Multiple endpoints';

      const issueBody = `## Problem Description
${analysis.issueDescription || 'Critical errors detected in the application'}

## Impact Assessment
- **Severity**: ${analysis.severity?.toUpperCase() || 'HIGH'}
- **Priority**: ${analysis.suggestedPriority || 'P1'}
- **Error Count**: ${errorCount} errors in ${timeRange}
- **Affected Components**: ${endpoints}

## Error Pattern
\`\`\`
${analysis.errorPattern || 'Multiple error occurrences detected'}
\`\`\`

## Error Logs
<details>
<summary>View Error Logs (${errorCount} total)</summary>

\`\`\`
${sampleLogs}
\`\`\`
</details>

## Root Cause Analysis
${analysis.rootCauseHypothesis || 'Investigation required to determine root cause'}

## Recommended Actions
${analysis.recommendation || 'Immediate investigation required'}

## Investigation Steps
1. Check application logs in SigNoz for the time period: ${timeRange}
2. Review recent deployments or configuration changes
3. Check resource utilization (CPU, memory, disk)
4. Verify database connections and external service availability
5. Review error patterns and stack traces

## Related Links
- [View in SigNoz](http://localhost:8080)
- [Repository](${repoUrl})

---
*🤖 This issue was automatically detected by AI monitoring system*
*Last analyzed: ${new Date().toISOString()}*`;

      return issueBody;
    } catch (error) {
      console.error('Error generating issue body:', error.message);
      throw error;
    }
  }

  formatLogsForDisplay(logs, limit = 10) {
    if (!logs || !logs.result || !logs.result[0] || !logs.result[0].list) {
      return 'No logs available';
    }

    const logEntries = logs.result[0].list.slice(0, limit);
    return logEntries.map((log, idx) => {
      const timestamp = new Date(log.timestamp / 1000000).toISOString();
      const level = log.data?.severity_text || 'INFO';
      const message = log.data?.body || JSON.stringify(log.data);
      return `[${idx + 1}] ${timestamp} | ${level.toUpperCase().padEnd(5)} | ${message}`;
    }).join('\n');
  }

  getTimeRange(logs) {
    if (!logs || !logs.result || !logs.result[0] || !logs.result[0].list || logs.result[0].list.length === 0) {
      return 'last 15 minutes';
    }

    const logsList = logs.result[0].list;
    const firstLog = logsList[logsList.length - 1];
    const lastLog = logsList[0];

    const firstTime = new Date(firstLog.timestamp / 1000000);
    const lastTime = new Date(lastLog.timestamp / 1000000);

    return `${firstTime.toLocaleTimeString()} - ${lastTime.toLocaleTimeString()}`;
  }

  formatLogsForAnalysis(logs, limit = 20) {
    if (!logs || !logs.result || !logs.result[0] || !logs.result[0].list) {
      return 'No logs available';
    }

    const logEntries = logs.result[0].list.slice(0, limit);
    return logEntries.map((log, idx) => {
      const timestamp = new Date(log.timestamp / 1000000).toISOString();
      const level = log.data?.severity_text || 'INFO';
      const message = log.data?.body || JSON.stringify(log.data);
      return `[${idx + 1}] ${timestamp} | ${level} | ${message}`;
    }).join('\n');
  }

  formatMetricsForAnalysis(metrics) {
    if (!metrics) return 'No metrics available';

    try {
      return `
Service Overview:
- Error Rate: ${metrics.errorRate || 'N/A'}
- Request Rate: ${metrics.callRate || 'N/A'}
- P99 Latency: ${metrics.p99 || 'N/A'}ms
- P95 Latency: ${metrics.p95 || 'N/A'}ms
- P50 Latency: ${metrics.p50 || 'N/A'}ms
`;
    } catch (error) {
      return 'Metrics format error';
    }
  }

  async summarizeLogs(logs, maxLength = 500) {
    try {
      const logsText = this.formatLogsForAnalysis(logs);

      const prompt = `Summarize these application logs in ${maxLength} characters or less. Focus on errors, patterns, and key events:

${logsText}

Provide a concise technical summary.`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 200
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error summarizing logs:', error.message);
      return 'Error summarizing logs';
    }
  }
}

export default AIAnalyzer;
