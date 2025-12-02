export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export function success<T>(data: T, statusCode = 200): ApiResponse {
  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify(data),
  };
}

export function error(message: string, statusCode = 500): ApiResponse {
  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify({ error: message }),
  };
}

export function notFound(message = 'Resource not found'): ApiResponse {
  return error(message, 404);
}

export function badRequest(message: string): ApiResponse {
  return error(message, 400);
}

export function unauthorized(message = 'Unauthorized'): ApiResponse {
  return error(message, 401);
}
