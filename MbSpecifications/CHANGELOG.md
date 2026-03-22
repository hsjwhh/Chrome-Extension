# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

### Added
- Added motherboard library lookup and create flow against the local hardware API.
- Added a review modal so scraped motherboard fields can be checked and edited before writing to the database.
- Added an auth modal for API base URL, username, and password input.
- Added ASUS motherboard tech spec page support with a dedicated parser.
- Added Enter key submission support for the API authentication modal.

### Changed
- Changed auth handling to reuse cached access tokens in the extension background worker.
- Changed credential persistence so only API base URL and username are stored persistently.
- Changed socket parsing to recognize more AMD platform names, including `sTR5`, `TR5`, and `SP5`.
- Refactored `apiRequest` and `authorizedRequest` to handle 401 retries and cache clearing correctly.
- Improved `apiRequest` robustness with JSON parsing protection and better error objects.
- Enhanced `sendAuthorizedMessage` to correctly handle authentication cancellation.

### Removed
- Removed deprecated and unused `content.js` file.

### Security
- Stopped persisting passwords in extension storage.

