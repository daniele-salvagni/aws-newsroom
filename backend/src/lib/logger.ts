import pino from 'pino';

/**
 * Extract X-Ray trace ID from environment variable
 * X-Amzn-Trace-Id: Root=1-5759e988-bd862e3fe1be46a994272793;Parent=53995c3f42cd8ad8;Sampled=1
 * X-Amzn-Trace-Id: Root=1-5759e988-bd862e3fe1be46a994272793;Parent=53995c3f42cd8ad8;Sampled=1;Lineage=25:a87bd80c:1
 * Lineage may be appended to the trace header by Lambda and other AWS services as part of their processing mechanisms, and should not be directly used.
 * https://docs.aws.amazon.com/xray/latest/devguide/xray-concepts.html#xray-concepts-tracingheader
 */
function getTraceId(): string | undefined {
  const traceHeader = process.env._X_AMZN_TRACE_ID;
  if (!traceHeader) return undefined;

  const match = traceHeader.match(/Root=([^;]+)/);
  return match ? match[1] : undefined;
}

/** Create a Pino logger with nested data and X-Ray trace ID support */
export function createLogger(name: string) {
  const baseLogger = pino({
    name,
    level: process.env.LOG_LEVEL || 'info',
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin: () => {
      const traceId = getTraceId();
      return traceId ? { traceId } : {};
    },
  });

  /** Wrap data under 'data' key for cleaner logs */
  const wrapData = (data?: object) => (data ? { data } : {});

  return {
    debug: (msg: string, data?: object) => baseLogger.debug(wrapData(data), msg),
    info: (msg: string, data?: object) => baseLogger.info(wrapData(data), msg),
    warn: (msg: string, data?: object) => baseLogger.warn(wrapData(data), msg),
    error: (msg: string, data?: object) => baseLogger.error(wrapData(data), msg),
  };
}
