import { APIGatewayProxyEvent } from 'aws-lambda';

export interface UserContext {
  userId: string;
  email: string;
  username: string;
}

export function getUserFromEvent(event: APIGatewayProxyEvent): UserContext | null {
  const claims = event.requestContext?.authorizer?.claims;

  if (!claims || !claims.sub) {
    return null;
  }

  return {
    userId: claims.sub,
    email: claims.email || '',
    username: claims.name || claims.email?.split('@')[0] || claims['cognito:username'] || '',
  };
}

export function requireUser(event: APIGatewayProxyEvent): UserContext {
  const user = getUserFromEvent(event);
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user;
}
