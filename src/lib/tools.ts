// Tool registry: one entry per tool page. Node-importable (tests read it), so islands load lazily.

export interface ToolEntry {
  slug: string;
  title: string;
  /** Short card blurb on the home page. */
  blurb: string;
  op: string;
  accepts: string;
  /** The island that renders the tool (see src/pages/[slug].astro). */
  island: string;
  /** Options a variant page preselects, passed to the island as props. */
  preset?: Record<string, string>;
  load: () => Promise<unknown>;
}

export const tools: ToolEntry[] = [
  {
    slug: 'mute-video',
    title: 'Mute video',
    blurb: 'Remove the sound from a video without re-encoding it.',
    op: 'mute',
    accepts: 'video/*',
    island: 'MuteVideo',
    load: () => import('../components/tools/MuteVideo.svelte'),
  },
];

export function toolBySlug(slug: string): ToolEntry | undefined {
  return tools.find((t) => t.slug === slug);
}
