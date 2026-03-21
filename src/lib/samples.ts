// Tiny bundled sample files (public/samples/, same origin) for the "Try a sample file" button.
export interface Sample {
  url: string;
  name: string;
  type: string;
}

export const VIDEO_SAMPLE: Sample = { url: '/samples/sample.mp4', name: 'framelab-sample.mp4', type: 'video/mp4' };
export const AUDIO_SAMPLE: Sample = { url: '/samples/sample.m4a', name: 'framelab-sample.m4a', type: 'audio/mp4' };

export function sampleFor(needs: 'video' | 'audio' | 'any'): Sample {
  return needs === 'audio' ? AUDIO_SAMPLE : VIDEO_SAMPLE;
}
