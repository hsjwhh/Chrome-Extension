# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [3.0] - 2026-03-25

### Added
- **Batch List Page Scraping**: Added full support for scraping multiple products from a list page.
  - Automatically detects product lists on supported sites (Asus, Gigabyte, Aorus, Supermicro, Intel).
  - New "Batch Mode" UI to select, scrape, and export multiple products at once.
  - Uses a background tab queue to reliably scrape CSR (Client-Side Rendered) pages without opening multiple visible tabs.
  - Adds random delays between requests to mimic human behavior.
- **Link Discovery**: Added `findLinks` capability to all parsers for intelligent product discovery on list pages.

### Changed
- **Parser Architecture**: Refactored all parsers (`asus.js`, `gigabyte.js`, `aorus.js`, `intel.js`, `supermicro.js`) to be environment-agnostic, accepting a custom `document` object.
- **Background Logic**: Updated `background.js` to manage a persistent background tab for batch jobs instead of stateless fetch requests.
- **Injection Rules**: Relaxed `PARSER_MAP` matching rules to allow scraper execution on list/category pages.

### Fixed
- **Intel Detection**: Fixed a bug where Intel product detail pages were incorrectly identified as list pages due to related product links.

## [2.0] - Unreleased
- Added motherboard library lookup and create flow against the local hardware API.
- Added a review modal so scraped motherboard fields can be checked and edited before writing to the database.
- Added an auth modal for API base URL, username, and password input.
- Added ASUS motherboard tech spec page support with a dedicated parser.
- Added Enter key submission support for the API authentication modal.
- Added Intel CPU specification page support with a dedicated parser and manifest permissions.
- Added CPU library lookup and create flow against `/api/hw/cpu`.
- Added CPU review modal field mapping, including generated `cpu_s_name` and `cpu_short_name`.

### Changed
- Changed auth handling to reuse cached access tokens in the extension background worker.
- Changed credential persistence so only API base URL and username are stored persistently.
- Changed socket parsing to recognize more AMD platform names, including `sTR5`, `TR5`, and `SP5`.
- Refactored `apiRequest` and `authorizedRequest` to handle 401 retries and cache clearing correctly.
- Improved `apiRequest` robustness with JSON parsing protection and better error objects.
- Enhanced `sendAuthorizedMessage` to correctly handle authentication cancellation.
- Improved Intel CPU name extraction to strip cache/frequency suffixes and normalize short names like `Intel i9-14901E`.
- Improved Intel CPU field extraction with fallback parsing for ECC, max memory, max turbo power, and mixed label variants.

### Removed
- Removed deprecated and unused `content.js` file.

### Security
- Stopped persisting passwords in extension storage.
