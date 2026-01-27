-- Migration: Add article_links table for storing external links from announcements
-- Run this against your Aurora DSQL database

-- Add raw_html column to news_articles
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS raw_html TEXT;

-- Article links table
CREATE TABLE IF NOT EXISTS article_links (
    link_id VARCHAR(64) PRIMARY KEY,
    article_id VARCHAR(64) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    title VARCHAR(500),
    domain VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ASYNC IF NOT EXISTS idx_article_links_article ON article_links(article_id);
CREATE INDEX ASYNC IF NOT EXISTS idx_article_links_domain ON article_links(domain);
CREATE UNIQUE INDEX ASYNC IF NOT EXISTS idx_article_links_unique ON article_links(article_id, url);
