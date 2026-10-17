---
name: NPM registry metadata fallback
description: Read-only package-version checks when Replit web search and fetch are unavailable.
---

When Replit `webSearch` and `webFetch` returned HTTP 402 for package-registry URLs, direct read-only requests to `https://registry.npmjs.org/<package>/latest` inside a `use impure` CodeExecution function returned package metadata.

**Why:** Current compatible package versions had to be checked, but both Replit web retrieval paths were unavailable.

**How to apply:** Use this only for public, read-only registry metadata such as latest versions and dependency ranges. Do not use it to bypass authentication or access controls, and do not log credentials or secrets.
