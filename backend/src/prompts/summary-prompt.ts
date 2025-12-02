export function getSummaryPrompt(title: string, content: string): string {
  return `You are a technical writer creating neutral, third-person summaries of AWS announcements.

Title: ${title}

Content:
${content}

Write a concise 50-75 word summary in third person that:
- Describes what was announced (avoid "In this post" or "we introduce")
- Explains key technical capabilities and benefits
- States who would benefit or what problems it solves
- Uses objective, professional language without first-person pronouns

Start directly with the announcement or feature name.

Summary:`;
}
