import { createClient } from '@clickhouse/client';
import logger from './logger.js';

class ClickHouseClient {
  constructor(host = 'localhost', port = 9000) {
    this.client = createClient({
      host: `http://${host}:8123`,
      database: 'signoz_logs'
    });
  }

  async getErrorLogs(serviceName, minutes = 15) {
    try {
      const startTime = Date.now() - (minutes * 60 * 1000);
      const endTime = Date.now();
      const startTimeNano = startTime * 1000000;
      const endTimeNano = endTime * 1000000;

      const query = `
        SELECT
          timestamp,
          severity_text,
          severity_number,
          body,
          trace_id,
          span_id,
          resources_string
        FROM signoz_logs.logs_v2
        WHERE
          timestamp >= ${startTimeNano}
          AND timestamp <= ${endTimeNano}
          AND resources_string['service.name'] = '${serviceName}'
          AND severity_text IN ('ERROR', 'error', 'Error')
        ORDER BY timestamp DESC
        LIMIT 100
      `;

      const result = await this.client.query({
        query: query,
        format: 'JSONEachRow'
      });

      const rows = await result.json();

      return {
        result: [{
          list: rows.map(row => ({
            timestamp: row.timestamp,
            data: {
              severity_text: row.severity_text,
              severity_number: row.severity_number,
              body: row.body,
              trace_id: row.trace_id,
              span_id: row.span_id,
              service_name: serviceName
            }
          }))
        }]
      };

    } catch (error) {
      logger.error('Error fetching logs', { error: error.message });
      throw error;
    }
  }

  async getAllLogs(serviceName, minutes = 15) {
    try {
      const startTime = Date.now() - (minutes * 60 * 1000);
      const endTime = Date.now();
      const startTimeNano = startTime * 1000000;
      const endTimeNano = endTime * 1000000;

      const query = `
        SELECT
          timestamp,
          severity_text,
          body,
          trace_id
        FROM signoz_logs.logs_v2
        WHERE
          timestamp >= ${startTimeNano}
          AND timestamp <= ${endTimeNano}
          AND resources_string['service.name'] = '${serviceName}'
        ORDER BY timestamp DESC
        LIMIT 1000
      `;

      const result = await this.client.query({
        query: query,
        format: 'JSONEachRow'
      });

      const rows = await result.json();

      return {
        result: [{
          list: rows.map(row => ({
            timestamp: row.timestamp,
            data: {
              severity_text: row.severity_text,
              body: row.body,
              trace_id: row.trace_id,
              service_name: serviceName
            }
          }))
        }]
      };

    } catch (error) {
      logger.error('Error fetching all logs from ClickHouse', {
        error: error.message
      });
      throw error;
    }
  }

  async getServiceMetrics(serviceName) {
    try {
      return null;
    } catch (error) {
      logger.error('Error fetching metrics', { error: error.message });
      return null;
    }
  }

  async close() {
    await this.client.close();
  }
}

export default ClickHouseClient;
