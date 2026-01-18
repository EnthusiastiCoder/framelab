#!/usr/bin/env node
// Generates the media fixtures in tests/fixtures/ (committed). Needs an ffmpeg CLI (FFMPEG env var or PATH)
// and, for the speech fixtures, Windows SAPI through PowerShell (System.Speech).
// Every file is kept tiny (low bitrates, short clips) so the repo stays small.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../tests/fixtures/', import.meta.url));
const WINGET_FFMPEG =
  'C:/Users/enthu/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-7.1.1-full_build/bin/ffmpeg.exe';
const FFMPEG = process.env.FFMPEG ?? (existsSync(WINGET_FFMPEG) ? WINGET_FFMPEG : 'ffmpeg');

const SPEECH_SCRIPT =
  'Hello and welcome to Framelab. Everything here runs in your browser. Your files never leave your device.';

function ff(args) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}\n${r.stderr}`);
}

const out = (name) => join(OUT, name);

// testsrc2 + 440 Hz sine, 30 fps, GOP 30 (a keyframe every second).
const video = (w, h, seconds) => ['-f', 'lavfi', '-i', `testsrc2=size=${w}x${h}:rate=30:duration=${seconds}`];
const tone = (seconds) => ['-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=48000:duration=${seconds}`];
const x264Crf = (crf) => ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-g', '30', '-keyint_min', '30', '-sc_threshold', '0', '-pix_fmt', 'yuv420p'];
const x264 = x264Crf(38);
const aac = ['-c:a', 'aac', '-b:a', '48k', '-ac', '1'];

function h264(name, w, h, seconds, withAudio = true, crf = 38) {
  ff([...video(w, h, seconds), ...(withAudio ? tone(seconds) : []), ...x264Crf(crf), ...(withAudio ? aac : ['-an']), '-shortest', out(name)]);
}

function speechWav(target) {
  const ps = [
    'Add-Type -AssemblyName System.Speech;',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;',
    '$s.Rate = 0;',
    `$s.SetOutputToWaveFile('${target.replace(/'/g, "''")}');`,
    `$s.Speak('${SPEECH_SCRIPT.replace(/'/g, "''")}');`,
    '$s.Dispose();',
  ].join(' ');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`SAPI failed: ${r.stderr}`);
}

mkdirSync(OUT, { recursive: true });

h264('h264-aac-640x360-5s.mp4', 640, 360, 5);
ff([
  ...video(640, 360, 5), ...tone(5),
  '-c:v', 'libvpx-vp9', '-b:v', '120k', '-deadline', 'realtime', '-cpu-used', '8', '-g', '30', '-pix_fmt', 'yuv420p',
  '-c:a', 'libopus', '-b:a', '32k', '-ac', '1', '-shortest', out('vp9-opus-640x360-5s.webm'),
]);
h264('h264-1280x720-3s-noaudio.mp4', 1280, 720, 3, false);
h264('h264-aac-3s.mov', 640, 360, 3);
h264('h264-aac-360x640-3s.mp4', 360, 640, 3);
h264('h264-aac-1920x1080-4s.mp4', 1920, 1080, 4, true, 46);

// Speech: SAPI renders to a temp wav, which ffmpeg resamples to 16 kHz mono (what Whisper consumes).
const rawSpeech = out('speech-raw.tmp.wav');
speechWav(rawSpeech);
ff(['-i', rawSpeech, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', out('speech-en.wav')]);
ff([
  '-f', 'lavfi', '-i', 'color=c=blue:size=640x360:rate=30', '-i', out('speech-en.wav'),
  ...x264, ...aac, '-shortest', out('speech-en.mp4'),
]);
spawnSync(process.platform === 'win32' ? 'cmd' : 'rm', process.platform === 'win32' ? ['/c', 'del', rawSpeech.replace(/\//g, '\\')] : ['-f', rawSpeech]);

// 10 s tones in each audio container.
ff([...tone(10), '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', out('tone-10s.wav')]);
ff([...tone(10), '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '48k', out('tone-10s.mp3')]);
ff([...tone(10), ...aac, out('tone-10s.m4a')]);
ff([...tone(10), '-ac', '1', '-c:a', 'libopus', '-b:a', '32k', out('tone-10s.ogg')]);

// Broken inputs: a truncated MP4 (no moov box) and a text file with a video extension.
writeFileSync(out('corrupt.mp4'), readFileSync(out('h264-aac-640x360-5s.mp4')).subarray(0, 20 * 1024));
writeFileSync(out('not-media.mp4'), 'This is a plain text file pretending to be a video. It is not media.\n');

let total = 0;
for (const name of [
  'h264-aac-640x360-5s.mp4', 'vp9-opus-640x360-5s.webm', 'h264-1280x720-3s-noaudio.mp4', 'h264-aac-3s.mov',
  'h264-aac-360x640-3s.mp4', 'h264-aac-1920x1080-4s.mp4', 'speech-en.wav', 'speech-en.mp4',
  'tone-10s.mp3', 'tone-10s.wav', 'tone-10s.m4a', 'tone-10s.ogg', 'corrupt.mp4', 'not-media.mp4',
]) {
  const size = statSync(out(name)).size;
  total += size;
  console.log(`${name.padEnd(32)} ${(size / 1024).toFixed(1)} KiB`);
}
console.log(`total ${(total / 1024).toFixed(1)} KiB`);
