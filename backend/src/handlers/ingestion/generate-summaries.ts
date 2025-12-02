import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { query } from '../../lib/db.js';
import { getSummaryPrompt } from '../../prompts/summary-prompt.js';

const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });

interface SummaryInput {
  batchSize?: number; // Number of articles to process in this invocation
}

interface ArticleQueryResult {
  article_id: string;
  title: string;
  description: string;
  source: string;
}

export const handler = async (event: SummaryInput = {}) => {
  console.log('Starting AI summary generation', event);

  const batchSize = event.batchSize || 100;

  try {
    // Find articles without AI summaries which have a description (aws-news)
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
    console.log(`Found ${articles.length} articles needing summaries`);

    if (articles.length === 0) {
      return {
        statusCode: 200,
        message: 'No articles need summaries',
        processed: 0,
      };
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each article individually
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
        console.log(`Generated summary for article ${article.article_id}`);
      } catch (error) {
        console.error(`Error generating summary for ${article.article_id}:`, error);
        errorCount++;
      }
    }

    return {
      statusCode: 200,
      processed: successCount,
      errors: errorCount,
      remaining: articles.length - successCount,
    };
  } catch (error) {
    console.error('Error in summary generation:', error);
    throw error;
  }
};

async function generateSummary(title: string, content: string): Promise<string> {
  // Limit to ~1000 tokens (~4000 characters)
  const MAX_CHARS = 4000;
  const truncatedContent =
    content.length > MAX_CHARS ? content.substring(0, MAX_CHARS) + '...' : content;

  const prompt = getSummaryPrompt(title, truncatedContent);

  const payload = {
    messages: [
      {
        role: 'user',
        content: [
          {
            text: prompt,
          },
        ],
      },
    ],
    inferenceConfig: {
      maxTokens: 150,
      temperature: 0.3,
    },
  };

  const command = new InvokeModelCommand({
    modelId: 'amazon.nova-lite-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  const summary = responseBody.output?.message?.content?.[0]?.text || '';

  if (!summary) {
    console.error('No summary in response:', JSON.stringify(responseBody));
    throw new Error('Empty summary received from Bedrock');
  }

  return summary.trim();
}
