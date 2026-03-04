/**
 * AWS News API Types
 */

export interface NewsItem {
  item: {
    id: string;
    name: string;
    author?: string;
    dateCreated: string;
    dateUpdated: string;
    additionalFields: {
      headline?: string;
      headlineUrl?: string;
      postBody?: string;
      postDateTime?: string;
      postSummary?: string;
      regionalAvailability?: string;
    };
  };
  tags?: Tag[];
}

export interface Tag {
  id: string;
  tagNamespaceId?: string;
  name: string;
  description?: string;
}

export interface APIResponse {
  metadata: {
    count: number;
    totalHits: number;
  };
  items: NewsItem[];
  fieldTypes?: Record<string, string>;
}

export interface FetchOptions {
  year: number;
  page: number;
  pageSize?: number;
}

export interface FetchResult {
  items: NewsItem[];
  totalHits: number;
}
