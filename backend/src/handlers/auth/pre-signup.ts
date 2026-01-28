import { PreSignUpTriggerEvent, PreSignUpTriggerHandler } from 'aws-lambda';
import { query } from '../../lib/db.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('pre-signup');
const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'example.com';

/** Cognito pre-signup trigger to validate email domain and create user */
export const handler: PreSignUpTriggerHandler = async (
  event: PreSignUpTriggerEvent
): Promise<PreSignUpTriggerEvent> => {
  const email = event.request.userAttributes.email;

  if (!email) {
    throw new Error('Email is required');
  }

  const emailDomain = email.split('@')[1];

  if (emailDomain !== ALLOWED_DOMAIN) {
    logger.warn('Email domain not allowed', { email, domain: emailDomain });
    throw new Error('Email not allowed.');
  }

  const userId = event.userName;
  const username = event.request.userAttributes.name;

  if (!username) {
    throw new Error('Username is required');
  }

  await query(
    `INSERT INTO users (user_id, email, username, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, email, username]
  );

  logger.info('User created', { userId, email });

  return event;
};
