/**
 * Dismissing the bar holds for a day whatever the CMS does: the cookie carries no content, so rewriting
 * the announcement does not override a visitor who already closed it.
 */

export const ANNOUNCEMENT_COOKIE_NAME = "announcement_dismissed";

export const ANNOUNCEMENT_COOKIE_MAX_AGE = 60 * 60 * 24;
