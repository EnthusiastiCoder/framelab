// Browser-side helpers for subtitle files: save an SRT/VTT and read one the user picked.

import type { Cue } from './cue';
import { parseSrt, serializeSrt } from './srt';
import { parseVtt, serializeVtt } from './vtt';

/** "clip.mp4" -> "clip-framelab.srt". */
export function subtitleFilename(inputName: string, ext: 'srt' | 'vtt'): string {
  const base = inputName.replace(/[\\/]/g, '_');
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return `${stem || 'subtitles'}-framelab.${ext}`;
}

/** Triggers a download of the cues as SRT or WebVTT. */
export function saveSubtitles(cues: Cue[], inputName: string, ext: 'srt' | 'vtt') {
  const text = ext === 'srt' ? serializeSrt(cues) : serializeVtt(cues);
  const blob = new Blob([text], { type: ext === 'srt' ? 'application/x-subrip' : 'text/vtt' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = subtitleFilename(inputName, ext);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Parses an SRT or WebVTT text: WebVTT when it has the WEBVTT header, SRT otherwise. */
export function parseSubtitles(text: string): Cue[] {
  return /^﻿?WEBVTT/.test(text) ? parseVtt(text) : parseSrt(text);
}
