/** One flag on <html>; the styling lives in global.css and Lenis is stopped by the caller. */
export function setPageScrollLock(locked: boolean) {
  if (locked) {
    document.documentElement.dataset.scrollLocked = "";
    return;
  }

  delete document.documentElement.dataset.scrollLocked;
}
