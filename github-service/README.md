# GitHub Service

REST API microservice for managing GitHub issues. This service provides a clean interface for creating, updating, and managing GitHub issues programmatically.

## Features

- ✅ Create GitHub issues with automatic duplicate detection
- ✅ Add comments to existing issues
- ✅ Close issues with optional closing comment
- ✅ List issues by state and labels
- ✅ RESTful API design
- ✅ Health check endpoint
- ✅ Comprehensive logging
- ✅ Error handling

## API Endpoints

### Health Check
```
GET /health
```
Returns service health status.

**Response:**
```json
{
  "success": true,
  "service": "github-service",
  "status": "healthy",
  "uptime": 123.45,
  "timestamp": "2024-11-26T00:00:00.000Z"
}
```

### Create Issue
```
POST /api/issues
```

**Request Body:**
```json
{
  "title": "Issue title",
  "body": "Detailed issue description",
  "labels": ["bug", "ai-detected"],
  "checkDuplicate": true
}
```

**Response:**
```json
{
  "success": true,
  "issue": {
    "number": 123,
    "url": "https://github.com/owner/repo/issues/123",
    "id": 123456789,
    "title": "Issue title",
    "state": "open",
    "createdAt": "2024-11-26T00:00:00Z"
  }
}
```

### Add Comment
```
POST /api/issues/:number/comments
```

**Request Body:**
```json
{
  "comment": "This is a comment"
}
```

### Close Issue
```
PATCH /api/issues/:number/close
```

**Request Body (optional):**
```json
{
  "comment": "Closing comment"
}
```

### List Issues
```
GET /api/issues?state=open&labels=bug
```

**Query Parameters:**
- `state`: `open`, `closed`, or `all` (default: `open`)
- `labels`: Comma-separated list of labels

## Installation

```bash
cd github-service
npm install
cp .env.example .env
```

## Configuration

Edit `.env`:

```env
# GitHub Configuration
GITHUB_TOKEN=ghp_your_token
GITHUB_OWNER=your-username
GITHUB_REPO=your-repo

# Server
PORT=3001
LOG_LEVEL=info
```

### Getting GitHub Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo` (full control of private repositories)
4. Generate and copy token

## Usage

### Start the service:
```bash
npm start
```

### Development mode:
```bash
npm run dev
```

The service will start on port 3001 (or your configured PORT).

## Testing

### Test health endpoint:
```bash
curl http://localhost:3001/health
```

### Create an issue:
```bash
curl -X POST http://localhost:3001/api/issues \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Issue",
    "body": "This is a test issue",
    "labels": ["test"]
  }'
```

### List issues:
```bash
curl http://localhost:3001/api/issues?state=open
```

## Integration

This service is designed to work with the AI Analyzer microservice:

```
AI Analyzer → GitHub Service → GitHub Issues → n8n
```

The AI Analyzer calls this service's API to create issues based on detected problems.

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error description",
  "message": "Detailed error message"
}
```

HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `500` - Internal Server Error

## Logging

Logs include:
- Request details
- GitHub API calls
- Errors and warnings
- Issue creation events

Log format:
```
2024-11-26 12:00:00 info: Creating GitHub issue {"title":"Test","labels":["bug"]}
```

## Architecture

```
┌─────────────────┐
│   AI Analyzer   │
└────────┬────────┘
         │ HTTP POST
         ↓
┌─────────────────┐
│ GitHub Service  │
│  - Express API  │
│  - Octokit      │
└────────┬────────┘
         │ GitHub API
         ↓
┌─────────────────┐
│  GitHub Issues  │
└─────────────────┘
```

## Dependencies

- `express` - Web framework
- `@octokit/rest` - GitHub API client
- `winston` - Logging
- `cors` - CORS support
- `dotenv` - Environment configuration

## Security

- API tokens stored in environment variables
- Never commit `.env` file
- Use HTTPS in production
- Validate all inputs
- Rate limiting recommended for production

## Production Deployment

1. Use process manager (PM2, systemd)
2. Set up reverse proxy (nginx)
3. Enable HTTPS
4. Configure environment variables
5. Set up monitoring
6. Enable rate limiting

Example PM2:
```bash
pm2 start index.js --name github-service
pm2 save
pm2 startup
```

## Troubleshooting

**"Missing required environment variables"**
- Check `.env` file exists
- Verify GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO are set

**"GitHub API error"**
- Verify token has `repo` scope
- Check token hasn't expired
- Verify repository exists and is accessible

**"Service not starting"**
- Check port 3001 is not in use
- Verify all dependencies installed
- Check logs for errors

## License

MIT
