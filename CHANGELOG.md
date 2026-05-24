# Changelog

<!-- markdownlint-disable MD024 -->

## Unreleased

### Added

- Environment profiles for switching Hurl executable paths, variables files, CLI arguments, template variables, and process environment variables per run
- Commands and status bar actions for selecting and clearing the active environment profile
- Updated built-in snippets to cover scoped variables, redirect flows, multipart uploads, and revised request templates
- Notebook view: open any `.hurl` file as a VS Code notebook with one cell per request entry
- `Hurl: Open as Notebook` command accessible from the command palette, the explorer context menu, and the editor title bar
- Notebook cell execution runs each request via hurl and renders results as markdown — status line, collapsible response headers, formatted JSON body, and assertion error snippets
- Notebook serializer round-trips `.hurl` files losslessly; markdown cells use `# md:` line prefix so files stay valid hurl syntax
- New custom extension icon (`hurl-icon.svg` / `hurl-icon.png`)

### Changed

- Revised TextMate grammar with more precise scope names across all token types
- Extended assert-predicate patterns to cover `isList`, `isObject`, `isUuid`, `isIpv4`, `isIpv6`
- Extended filter-keyword patterns with `base64Decode`, `base64Encode`, `base64UrlSafeDecode`, `base64UrlSafeEncode`, `first`, `last`, `location`, `toHex`, `toString`, `utf8Decode`, `utf8Encode`, `replaceRegex`, `urlQueryParam`, `dateFormat`
- Extended option-keyword patterns with `cacert`, `cert`, `key`, `connect-timeout`, `limit-rate`, `max-time`, `netrc`, `netrc-file`, `netrc-optional`, `path-as-is`, `pinnedpubkey`, `repeat`, `user`
- `{{...}}` template expressions now highlight variable names and built-in functions (`getEnv`, `newDate`, `newUuid`) separately
- Added dedicated highlighting for backtick one-line strings, `base64,…;`, `hex,…;`, and `file,…;` literals
- Added `key-value` pattern for generic header and form-param lines
- CodeLens buttons are suppressed inside notebook cells, which have their own native run controls

## 0.1.0 (2026-03-20)

### Added

- TextMate grammar for `.hurl` files with full syntax highlighting
- HTTP methods, URLs, headers, status codes, sections, variables, and embedded JSON/XML/GraphQL
- IntelliSense completions for methods, headers, content types, sections, status codes, assert predicates, filter functions, options, and variables
- CodeLens "Run Request" and "Run All" buttons above each request entry
- Hover documentation for methods, status codes, sections, options, predicates, filters, and headers
- Diagnostics for invalid methods, malformed URLs, unknown sections, invalid status codes, and unclosed variables
- 9 built-in snippets covering common Hurl patterns
- Configurable hurl binary path, variables file, and additional arguments
- Optional response webview panel
