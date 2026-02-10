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
  {
    slug: 'compress-video',
    title: 'Compress video',
    blurb: 'Make a video smaller with a quality preset or a target size.',
    op: 'compress',
    accepts: 'video/*',
    island: 'Compress',
    load: () => import('../components/tools/Compress.svelte'),
  },
  {
    slug: 'convert-video',
    title: 'Convert video',
    blurb: 'Turn MOV, WebM or MKV into MP4, or MP4 into WebM.',
    op: 'convert',
    accepts: 'video/*',
    island: 'Convert',
    load: () => import('../components/tools/Convert.svelte'),
  },
  {
    slug: 'trim-video',
    title: 'Trim video',
    blurb: 'Keep just the part you want, frame-exact or instantly.',
    op: 'trim',
    accepts: 'video/*',
    island: 'Trim',
    load: () => import('../components/tools/Trim.svelte'),
  },
  {
    slug: 'cut-video',
    title: 'Cut video',
    blurb: 'Remove sections from a video and keep the rest in sync.',
    op: 'cut',
    accepts: 'video/*',
    island: 'Cut',
    load: () => import('../components/tools/Cut.svelte'),
  },
  {
    slug: 'video-to-gif',
    title: 'Video to GIF',
    blurb: 'Turn a short clip into a looping GIF.',
    op: 'gif',
    accepts: 'video/*',
    island: 'ToGif',
    load: () => import('../components/tools/ToGif.svelte'),
  },
  {
    slug: 'extract-audio',
    title: 'Extract audio',
    blurb: 'Save the sound of a video as MP3, M4A, WAV or Opus.',
    op: 'extract-audio',
    accepts: 'video/*',
    island: 'ExtractAudio',
    load: () => import('../components/tools/ExtractAudio.svelte'),
  },
  {
    slug: 'resize-video',
    title: 'Resize video',
    blurb: 'Reframe a video to 9:16, 1:1, 4:5 or 16:9.',
    op: 'resize',
    accepts: 'video/*',
    island: 'ResizeCrop',
    load: () => import('../components/tools/ResizeCrop.svelte'),
  },
  {
    slug: 'audio-cutter',
    title: 'Audio cutter',
    blurb: 'Cut a piece out of an audio file, with fades.',
    op: 'audio-cut',
    accepts: 'audio/*',
    island: 'AudioCutter',
    load: () => import('../components/tools/AudioCutter.svelte'),
  },
  {
    slug: 'audio-converter',
    title: 'Audio converter',
    blurb: 'Convert audio to MP3, M4A, WAV, Opus or FLAC.',
    op: 'audio-convert',
    accepts: 'audio/*',
    island: 'AudioConverter',
    load: () => import('../components/tools/AudioConverter.svelte'),
  },
  {
    slug: 'mov-to-mp4',
    title: 'MOV to MP4',
    blurb: 'Turn an iPhone or QuickTime MOV into an MP4.',
    op: 'convert',
    accepts: 'video/*',
    island: 'Convert',
    preset: { format: 'mp4' },
    load: () => import('../components/tools/Convert.svelte'),
  },
  {
    slug: 'webm-to-mp4',
    title: 'WebM to MP4',
    blurb: 'Turn a WebM into an MP4 that plays everywhere.',
    op: 'convert',
    accepts: 'video/*',
    island: 'Convert',
    preset: { format: 'mp4' },
    load: () => import('../components/tools/Convert.svelte'),
  },
  {
    slug: 'mp4-to-webm',
    title: 'MP4 to WebM',
    blurb: 'Turn an MP4 into an open, web-friendly WebM.',
    op: 'convert',
    accepts: 'video/*',
    island: 'Convert',
    preset: { format: 'webm' },
    load: () => import('../components/tools/Convert.svelte'),
  },
  {
    slug: 'video-to-mp3',
    title: 'Video to MP3',
    blurb: 'Save the soundtrack of a video as an MP3.',
    op: 'extract-audio',
    accepts: 'video/*',
    island: 'ExtractAudio',
    preset: { format: 'mp3' },
    load: () => import('../components/tools/ExtractAudio.svelte'),
  },
];

export function toolBySlug(slug: string): ToolEntry | undefined {
  return tools.find((t) => t.slug === slug);
}
