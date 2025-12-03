-- Aurora DSQL Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT email_format CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE INDEX ASYNC IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX ASYNC IF NOT EXISTS idx_users_created_at ON users(created_at);

-- News articles table
CREATE TABLE IF NOT EXISTS news_articles (
    article_id VARCHAR(64) PRIMARY KEY,
    aws_source_id VARCHAR(255),
    source VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    url VARCHAR(1000) NOT NULL UNIQUE,
    description TEXT,
    blog_category VARCHAR(100),
    ai_summary TEXT,
    summary_generated_at TIMESTAMP,
    published_at TIMESTAMP NOT NULL,
    ingested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_source CHECK (source IN ('aws-news', 'aws-blog'))
);

CREATE INDEX ASYNC IF NOT EXISTS idx_articles_published ON news_articles(published_at);
CREATE INDEX ASYNC IF NOT EXISTS idx_articles_source ON news_articles(source);
CREATE INDEX ASYNC IF NOT EXISTS idx_articles_ingested ON news_articles(ingested_at);
CREATE INDEX ASYNC IF NOT EXISTS idx_articles_aws_source_id ON news_articles(aws_source_id);

-- User starred articles table
CREATE TABLE IF NOT EXISTS user_starred_articles (
    star_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    article_id VARCHAR(64) NOT NULL,
    starred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX ASYNC IF NOT EXISTS idx_starred_user_article ON user_starred_articles(user_id, article_id);
CREATE INDEX ASYNC IF NOT EXISTS idx_starred_article ON user_starred_articles(article_id);
CREATE INDEX ASYNC IF NOT EXISTS idx_starred_user ON user_starred_articles(user_id, starred_at);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    comment_id VARCHAR(64) PRIMARY KEY,
    article_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT content_not_empty CHECK (LENGTH(TRIM(content)) > 0)
);

CREATE INDEX ASYNC IF NOT EXISTS idx_comments_article ON comments(article_id, created_at);
CREATE INDEX ASYNC IF NOT EXISTS idx_comments_user ON comments(user_id, created_at);

-- User hashtags table (comment-based article tagging)
CREATE TABLE IF NOT EXISTS user_hashtags (
    hashtag_id VARCHAR(64) PRIMARY KEY,
    article_id VARCHAR(64) NOT NULL,
    comment_id VARCHAR(64) NOT NULL,
    created_by VARCHAR(128) NOT NULL,
    hashtag VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ASYNC IF NOT EXISTS idx_hashtags_article ON user_hashtags(article_id);
CREATE INDEX ASYNC IF NOT EXISTS idx_hashtags_tag ON user_hashtags(hashtag);
CREATE UNIQUE INDEX ASYNC IF NOT EXISTS idx_hashtags_unique ON user_hashtags(comment_id, hashtag);

-- Events table (for events like AWS re:Invent keynotes)
CREATE TABLE IF NOT EXISTS events (
    event_id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    category VARCHAR(100) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ASYNC IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX ASYNC IF NOT EXISTS idx_events_category ON events(category);
