/**
 * Immediately run a function and return its result (JSX-friendly IIFE / `do` expression).
 * @see https://maxgreenwald.me/blog/do-more-with-run
 */
export function run<T>(fn: () => T): T {
  return fn();
}

export function getObjectKeys<T extends object>(obj: T) {
  return Object.keys(obj) as (keyof T)[];
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Shuffle an array (Fisher-Yates); returns a new array, does not mutate the input. */
export function shuffle<T>(array: T[]): T[] {
  const arr = array.slice();

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    // biome-ignore lint/style/noNonNullAssertion: safe
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }

  return arr;
}

export function capitalize(str: string): string {
  if (!str) {
    return str;
  }

  return str.charAt(0).toUpperCase() + str.slice(1);
}
