import axios from 'axios';

class SigNozClient {
  constructor(baseUrl, apiKey = null) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    console.log('SigNoz Client Initialized:', {
      baseUrl,
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey ? apiKey.length : 0
    });
    this.client = axios.create({
      baseURL: baseUrl,
      headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
    });

    // Debug: Log request headers
    this.client.interceptors.request.use(config => {
      console.log('Making request to:', config.url);
      console.log('Headers:', config.headers);
      return config;
    });
  }

  async getRecentLogs(serviceName, minutes = 15) {
    try {
      const endTime = Date.now() * 1000000;
      const startTime = (Date.now() - minutes * 60 * 1000) * 1000000;

      const response = await this.client.post('/api/v3/query_range', {
        start: startTime,
        end: endTime,
        step: 60,
        queries: {
          A: {
            queryType: 'builder',
            dataSource: 'logs',
            aggregateOperator: 'count',
            aggregateAttribute: {
              key: 'id',
              dataType: 'string',
              type: 'tag'
            },
            filters: {
              items: [
                {
                  key: {
                    key: 'service_name',
                    dataType: 'string',
                    type: 'tag'
                  },
                  op: '=',
                  value: serviceName
                }
              ],
              op: 'AND'
            },
            limit: 1000,
            orderBy: [{
              columnName: 'timestamp',
              order: 'desc'
            }]
          }
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching logs from SigNoz:', error.message);
      throw error;
    }
  }

  async getErrorLogs(serviceName, minutes = 15) {
    try {
      const endTime = Date.now() * 1000000;
      const startTime = (Date.now() - minutes * 60 * 1000) * 1000000;

      const response = await this.client.post('/api/v3/query_range', {
        start: startTime,
        end: endTime,
        step: 60,
        queries: {
          A: {
            queryType: 'builder',
            dataSource: 'logs',
            aggregateOperator: 'count',
            aggregateAttribute: {
              key: 'id',
              dataType: 'string',
              type: 'tag'
            },
            filters: {
              items: [
                {
                  key: {
                    key: 'service_name',
                    dataType: 'string',
                    type: 'tag'
                  },
                  op: '=',
                  value: serviceName
                },
                {
                  key: {
                    key: 'severity_text',
                    dataType: 'string',
                    type: 'tag'
                  },
                  op: 'in',
                  value: ['ERROR', 'error', 'Error']
                }
              ],
              op: 'AND'
            },
            limit: 100,
            orderBy: [{
              columnName: 'timestamp',
              order: 'desc'
            }]
          }
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching error logs from SigNoz:', error.message);
      throw error;
    }
  }

  async getServiceMetrics(serviceName) {
    try {
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - 900;

      const response = await this.client.post('/api/v2/service/overview', {
        start: startTime * 1000000000,
        end: endTime * 1000000000,
        service: serviceName
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching service metrics:', error.message);
      return null;
    }
  }

  async getTraces(serviceName, minutes = 15) {
    try {
      const endTime = Date.now() * 1000000;
      const startTime = (Date.now() - minutes * 60 * 1000) * 1000000;

      const response = await this.client.post('/api/v3/query_range', {
        start: startTime,
        end: endTime,
        step: 60,
        queries: {
          A: {
            queryType: 'builder',
            dataSource: 'traces',
            aggregateOperator: 'count',
            aggregateAttribute: {
              key: '',
              dataType: '',
              type: ''
            },
            filters: {
              items: [
                {
                  key: {
                    key: 'serviceName',
                    dataType: 'string',
                    type: 'tag'
                  },
                  op: '=',
                  value: serviceName
                }
              ],
              op: 'AND'
            },
            limit: 100,
            orderBy: [{
              columnName: 'timestamp',
              order: 'desc'
            }]
          }
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching traces from SigNoz:', error.message);
      throw error;
    }
  }
}

export default SigNozClient;
