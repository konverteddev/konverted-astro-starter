# Umami Tracking

This starter provides lightweight Umami helpers in `src/features/umami/` for analytics that fail soft.

## Overview

- Helpers no-op when Umami is not loaded
- Supports page views and custom events
- Supports identify calls with optional metadata
- The script tag in `src/layouts/Web.astro` only renders when `PUBLIC_UMAMI_WEBSITE_ID` is set, and carries a `data-domains` allowlist derived from `PUBLIC_SITE_URL` (apex + www). On localhost the allowlist is skipped entirely, so local and preview visits are never tracked.

## Usage

```ts
import { track, identify } from '~/features/umami/tracking'

track()
track('cta-primary', { id: 'hero' })
identify('user_123', { plan: 'pro' })
```

## Setup

1. Create the website in your Umami dashboard and set `PUBLIC_UMAMI_WEBSITE_ID` in the environment
2. Use `track` and `identify` in client runtime paths (custom elements) where analytics are needed; see the `umami-analytics` skill for conventions
