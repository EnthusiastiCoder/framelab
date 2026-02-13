// Cut (remove sections): decodes the kept ranges of every track, re-times them back to back and re-encodes them
// into one output, so the cuts are frame-exact and audio stays in sync. Runs in the worker.

import {
  AudioSampleSink,
  AudioSampleSource,
  BufferTarget,
  Output,
  QUALITY_HIGH,
  VideoSampleSink,
  VideoSampleSource,
  type AudioCodec,
  type VideoSample,
  type VideoCodec,
} from 'mediabunny';
import { EngineError, type CutJob, type Result } from '../types';
import { MIME, outputFilename } from '../output';
import { rangesDuration } from '../ranges';
import { openInput } from './probe';
import { sliceAudio } from './audio';
import { abortableDelay, cancelled, outputFormatFor, type RunOptions } from './convert';
import { ensureEncoder } from './encoders';

/**
 * Optional per-frame hook (burn-in): receives each re-timed frame and returns the frame to encode (a new sample,
 * which cut closes after encoding, or the same one). A hooked output is written upright (rotation 0), so the hook
 * must return display-oriented frames.
 */
export interface FrameHook {
  frame: (sample: VideoSample) => VideoSample | Promise<VideoSample>;
}

export async function cut(file: File, job: CutJob, opts: RunOptions = {}, hook?: FrameHook): Promise<Result> {
  const { onProgress, signal, slowMs } = opts;
  if (slowMs && slowMs > 0) {
    await abortableDelay(slowMs, signal, (r) => onProgress?.({ phase: 'reading', ratio: r * 0.1 }));
  }
  if (signal?.aborted) throw cancelled();
  const keep = job.keep.filter(([a, b]) => b > a);
  const total = rangesDuration(keep);
  if (keep.length === 0 || total <= 0) throw new EngineError('UNSUPPORTED_INPUT', 'Nothing would be left after these cuts.');
  await ensureEncoder(job.output.audioCodec);

  const input = openInput(file);
  try {
    const videoTrack = job.output.videoCodec ? await input.getPrimaryVideoTrack() : null;
    const audioTrack = job.output.audioCodec ? await input.getPrimaryAudioTrack() : null;
    if (!videoTrack && !audioTrack) throw new EngineError('UNSUPPORTED_INPUT', 'This file has no video or audio to cut.');

    const { format, ext } = outputFormatFor(job.output.container);
    const target = new BufferTarget();
    const output = new Output({ format, target });

    let videoSource: VideoSampleSource | null = null;
    if (videoTrack) {
      videoSource = new VideoSampleSource({
        codec: job.output.videoCodec as VideoCodec,
        bitrate: job.videoBitrate ?? QUALITY_HIGH,
      });
      const stats = await videoTrack.computePacketStats(60).catch(() => null);
      output.addVideoTrack(videoSource, {
        rotation: hook ? 0 : videoTrack.rotation,
        ...(stats?.averagePacketRate ? { frameRate: Math.round(stats.averagePacketRate) } : {}),
      });
    }
    let audioSource: AudioSampleSource | null = null;
    if (audioTrack) {
      audioSource = new AudioSampleSource({ codec: job.output.audioCodec as AudioCodec, bitrate: QUALITY_HIGH });
      output.addAudioTrack(audioSource);
    }
    await output.start();

    let videoDone = 0;
    let audioDone = 0;
    const report = () => {
      const done = Math.min(videoTrack ? videoDone : Infinity, audioTrack ? audioDone : Infinity);
      onProgress?.({ phase: 'processing', ratio: 0.05 + 0.9 * Math.min(1, done / total) });
    };

    const pumpVideo = async () => {
      if (!videoTrack || !videoSource) return;
      const sink = new VideoSampleSink(videoTrack);
      let offset = 0;
      for (const [a, b] of keep) {
        for await (const sample of sink.samples(a, b)) {
          try {
            if (signal?.aborted) throw cancelled();
            const start = Math.max(a, sample.timestamp);
            const end = Math.min(b, sample.timestamp + sample.duration);
            if (end <= start) continue;
            sample.setTimestamp(offset + (start - a));
            sample.setDuration(end - start);
            if (hook) {
              const drawn = await hook.frame(sample);
              try {
                await videoSource.add(drawn);
              } finally {
                if (drawn !== sample) drawn.close();
              }
            } else {
              await videoSource.add(sample);
            }
            videoDone = offset + (end - a);
            report();
          } finally {
            sample.close();
          }
        }
        offset += b - a;
      }
      videoSource.close();
    };

    const pumpAudio = async () => {
      if (!audioTrack || !audioSource) return;
      const sink = new AudioSampleSink(audioTrack);
      let offset = 0;
      for (const [a, b] of keep) {
        for await (const sample of sink.samples(a, b)) {
          try {
            if (signal?.aborted) throw cancelled();
            const piece = sliceAudio(sample, a, b, offset);
            if (!piece) continue;
            await audioSource.add(piece);
            audioDone = piece.timestamp + piece.duration;
            piece.close();
            report();
          } finally {
            sample.close();
          }
        }
        offset += b - a;
      }
      audioSource.close();
    };

    try {
      await Promise.all([pumpVideo(), pumpAudio()]);
      await output.finalize();
    } catch (err) {
      await output.cancel().catch(() => {});
      if (signal?.aborted) throw cancelled();
      throw err;
    }
    if (!target.buffer) throw new EngineError('INTERNAL', 'The output was empty.');
    onProgress?.({ phase: 'done', ratio: 1 });
    const mimeType = MIME[ext] ?? 'application/octet-stream';
    const blob = new Blob([target.buffer], { type: mimeType });
    return { blob, filename: outputFilename(file.name, ext), mimeType, size: blob.size };
  } finally {
    input.dispose();
  }
}
