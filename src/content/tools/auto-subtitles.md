---
title: "Auto Subtitles From Speech, Private and Free | Framelab"
description: "Turn speech in a video or audio file into editable subtitles with Whisper running in your browser. Export SRT or VTT, or burn them in. Nothing is uploaded."
h1: "Generate subtitles automatically"
promise: "Speech becomes editable subtitles, and your audio never leaves this device."
howTo:
  - "Drop your video or audio file on the box above, or press Enter to choose a file."
  - "Pick a model and press \"Generate subtitles\". The first time, confirm the one-time model download."
  - "Fix any words in the editor, then download SRT or VTT, or burn the subtitles into the video."
faq:
  - q: "Is my audio sent to a server for transcription?"
    a: "No. The Whisper speech model runs inside your browser on your own device. The badge under the tool counts requests to other sites, and it stays at zero."
  - q: "Why is there a download before the first run?"
    a: "The speech model is a file of tens of megabytes. It downloads once from this site, after you confirm its size, and then stays in your browser for next time."
  - q: "Which model should I pick?"
    a: "Tiny is the fastest and smallest. Base is a good balance and the default. Small makes the fewest mistakes but is the largest download and the slowest."
  - q: "How do I remove a downloaded model?"
    a: "Open the privacy page and press \"Delete downloaded models\". The next run asks before downloading again."
  - q: "Can I download the subtitles as SRT or VTT for free?"
    a: "Yes. SRT and VTT downloads and burned-in captions are free, with no watermark. As checked on 22 November 2026, Kapwing's free plan limited auto subtitles to 10 minutes and kept SRT and VTT downloads for paid plans."
  - q: "Is there a length limit or a watermark?"
    a: "No. There is no length cap, no watermark and no sign-up. Long recordings simply take longer, and the time depends on your device."
related: [burn-subtitles, extract-audio, cut-video]
---

Auto subtitles uses OpenAI's Whisper model, converted to run in the browser with WebAssembly. Speech is split into short, readable cues of at most two lines, which you can edit, split, merge or delete before you export them.
