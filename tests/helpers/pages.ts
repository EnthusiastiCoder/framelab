// The list of pages the site serves, derived from the tool registry (so it grows with each workstream).
export const STATIC_PAGES = ['/', '/privacy', '/licenses', '/about'];

export async function toolSlugs(): Promise<string[]> {
  const { tools } = await import('../../src/lib/tools');
  return tools.map((t: { slug: string }) => t.slug);
}

export async function allPages(): Promise<string[]> {
  return [...STATIC_PAGES, ...(await toolSlugs()).map((s) => `/${s}`)];
}

/** Every slug the finished site must have (plan "Tools and pages"); used by WS4 checks. */
export const PLAN_TOOL_SLUGS = [
  'compress-video',
  'convert-video',
  'mov-to-mp4',
  'webm-to-mp4',
  'mp4-to-webm',
  'trim-video',
  'cut-video',
  'video-to-gif',
  'mute-video',
  'extract-audio',
  'video-to-mp3',
  'resize-video',
  'crop-video',
  'audio-cutter',
  'audio-converter',
  'auto-subtitles',
  'burn-subtitles',
];

/** WS4 page list: every page plus the comparison page added in WS4. */
export const COMPARISON_PAGE = '/no-watermark-video-editor';

export async function finishedSitePages(): Promise<string[]> {
  return [...(await allPages()), COMPARISON_PAGE];
}
