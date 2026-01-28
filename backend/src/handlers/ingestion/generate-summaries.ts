import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { query } from '../../lib/db.js';
import { getSummaryPrompt } from '../../prompts/summary-prompt.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('generate-summaries');
const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });

interface SummaryInput {
  batchSize?: number;
}

interface ArticleQueryResult {
  article_id: string;
  title: string;
  description: string;
  source: string;
}

/** Generate AI summaries for articles that don't have one */
export const handler = async (event: SummaryInput = {}) => {
  logger.info('Starting AI summary generation', { event });

  const batchSize = event.batchSize || 100;

  try {
    const articles = await query<ArticleQueryResult>(
      `SELECT article_id, title, description, source
       FROM news_articles
       WHERE ai_summary IS NULL
         AND description IS NOT NULL
         AND LENGTH(description) > 100
         AND source = 'aws-news'
       ORDER BY published_at DESC
       LIMIT $1`,
      [batchSize]
    );

    logger.info('Articles found needing summaries', { count: articles.length });

    if (articles.length === 0) {
      return { statusCode: 200, message: 'No articles need summaries', processed: 0 };
    }

    let successCount = 0;
    let errorCount = 0;

    for (const article of articles) {
      try {
        const summary = await generateSummary(article.title, article.description);

        await query(
          `UPDATE news_articles
           SET ai_summary = $1, summary_generated_at = CURRENT_TIMESTAMP
           WHERE article_id = $2`,
          [summary, article.article_id]
        );

        successCount++;
        logger.debug('Summary generated', { articleId: article.article_id });
      } catch (error) {
        logger.error('Failed to generate summary', { articleId: article.article_id, error });
        errorCount++;
      }
    }

    logger.info('Summary generation completed', { successCount, errorCount });

    return {
      statusCode: 200,
      processed: successCount,
      errors: errorCount,
      remaining: articles.length - successCount,
    };
  } catch (error) {
    logger.error('Summary generation failed', { error });
    throw error;
  }
};

/** Generate a summary using Amazon Bedrock */
async function generateSummary(title: string, content: string): Promise<string> {
  const MAX_CHARS = 4000;
  const truncatedContent =
    content.length > MAX_CHARS ? content.substring(0, MAX_CHARS) + '...' : content;

  const prompt = getSummaryPrompt(title, truncatedContent);

  const command = new InvokeModelCommand({
    modelId: 'amazon.nova-lite-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 150, temperature: 0.3 },
    }),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const summary = responseBody.output?.message?.content?.[0]?.text || '';

  if (!summary) {
    logger.error('Empty summary received', { responseBody });
    throw new Error('Empty summary received from Bedrock');
  }

  return summary.trim();
}
