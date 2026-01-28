# AWS News Client

Client for fetching AWS What's New articles from the public API.

## API Details

**Endpoint:** `https://aws.amazon.com/api/dirs/items/search`

**Pagination:**

- `size`: items per page
- `page`: 0-indexed
- API does not return more than 100th page, so filtering by year tag is required
  for historical data

## Tag Formats

The only way to filter articles by year is through tags, the format of which
could vary.

Until 2026, we have seen two formats so far:

- `whats-new-v2#year#YYYY` - (standard) for 2024 and earlier, and in 2026, it
  was the only format
- `GLOBAL#local-tags-whats-new-v2-year#YYYY` - used only in 2025, alongside the
  standard tag

The client handles this defensively by trying both formats and deduplicating the
results.

## Known Issues

- Some late-year articles are tagged with the next year (e.g., Dec 2025 items
  tagged as 2026)
- The client tries both tag formats and deduplicates to handle inconsistencies
- `diagnostics.itemsWithMismatchedYearTag` tracks these cases
