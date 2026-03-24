# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

### Added
- Added support for scraping Aorus motherboard specifications (`parsers/aorus.js`).
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
