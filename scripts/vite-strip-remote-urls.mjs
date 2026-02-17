// Vite plugin: removes the scheme from every absolute http(s) URL inside @huggingface/transformers and onnxruntime-web, so the
// built bundle holds no third-party URL at all (check-dist enforces this). Framelab never uses those defaults:
// the ASR worker sets env.remoteHost to our own /models/ and clears ORT's wasmPaths before anything loads,
// and the rest are documentation links inside error messages and licence headers, which still read fine
// without "https://".
const TARGET = /[\\/]node_modules[\\/](?:@huggingface[\\/]transformers|onnxruntime-web|onnxruntime-common)[\\/]/;
const ABSOLUTE = /\bhttps?:\/\/(?=[a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi;

export function stripRemoteUrls(code) {
  return code.replace(ABSOLUTE, '');
}

export default function stripRemoteUrlsPlugin() {
  return {
    name: 'framelab-strip-remote-urls',
    transform(code, id) {
      if (!TARGET.test(id)) return null;
      const out = stripRemoteUrls(code);
      return out === code ? null : { code: out, map: null };
    },
  };
}
