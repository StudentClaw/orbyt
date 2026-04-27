export const COMPOSER_FOOTER_COMPACT_BREAKPOINT_PX = 560

export function shouldUseCompactComposerFooter(width: number | null): boolean {
  return width !== null && width > 0 && width < COMPOSER_FOOTER_COMPACT_BREAKPOINT_PX
}
