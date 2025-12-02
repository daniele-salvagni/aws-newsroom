import { PreSignUpTriggerEvent, PreSignUpTriggerHandler } from 'aws-lambda';
import { query } from '../../lib/db.js';

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'example.com';

export const handler: PreSignUpTriggerHandler = async (
  event: PreSignUpTriggerEvent
): Promise<PreSignUpTriggerEvent> => {
  const email = event.request.userAttributes.email;

  if (!email) {
    throw new Error('Email is required');
  }

  const emailDomain = email.split('@')[1];

  if (emailDomain !== ALLOWED_DOMAIN) {
    throw new Error(`Email not allowed.`);
  }

  // Create user in database
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

  return event;
};
