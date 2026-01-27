export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/** Default CORS headers for API responses */
const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

/** Return a successful JSON response */
export function success<T>(data: T, statusCode = 200): ApiResponse {
  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify(data),
  };
}

/** Return an error JSON response */
export function error(message: string, statusCode = 500): ApiResponse {
  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify({ error: message }),
  };
}

/** Return a 404 not found response */
export function notFound(message = 'Resource not found'): ApiResponse {
  return error(message, 404);
}

/** Return a 400 bad request response */
export function badRequest(message: string): ApiResponse {
  return error(message, 400);
}

/** Return a 401 unauthorized response */
export function unauthorized(message = 'Unauthorized'): ApiResponse {
  return error(message, 401);
}
