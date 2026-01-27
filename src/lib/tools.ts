// Tool registry: one entry per tool page. Node-importable (tests read it), so islands load lazily.

export interface ToolEntry {
  slug: string;
  title: string;
  /** Short card blurb on the home page. */
  blurb: string;
  op: string;
  accepts: string;
  load: () => Promise<unknown>;
}

export const tools: ToolEntry[] = [
  {
    slug: 'mute-video',
    title: 'Mute video',
    blurb: 'Remove the sound from a video without re-encoding it.',
    op: 'mute',
    accepts: 'video/*',
    load: () => import('../components/tools/MuteVideo.svelte'),
  },
];

export function toolBySlug(slug: string): ToolEntry | undefined {
  return tools.find((t) => t.slug === slug);
}
