/** A missing settings row uses the same enabled default as UserSettings. */
export function accountAllowsAiDeepHelp(value: unknown): boolean {
  return value === null || value === undefined || Number(value) !== 0;
}
