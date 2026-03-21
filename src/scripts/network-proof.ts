// Live proof that nothing leaves the device: counts resource requests to other origins (PerformanceObserver)
// and writes the count into every [data-testid="network-proof"] badge on the page.
const seen = new Set<string>();

function render() {
  for (const el of document.querySelectorAll<HTMLElement>('[data-testid="network-proof"]')) {
    const text = el.querySelector('.proof-text');
    if (!text) continue;
    el.classList.toggle('bad', seen.size > 0);
    text.textContent =
      seen.size === 0
        ? '0 requests to other sites'
        : `${seen.size} request${seen.size === 1 ? '' : 's'} to other sites: ${[...seen].map((u) => new URL(u).host).join(', ')}`;
  }
}

function check(name: string) {
  if (name.startsWith('data:') || name.startsWith('blob:')) return;
  try {
    if (new URL(name).origin !== location.origin && !seen.has(name)) {
      seen.add(name);
      render();
    }
  } catch {
    /* ignore unparsable entries */
  }
}

for (const e of performance.getEntriesByType('resource')) check(e.name);
render();
if (typeof PerformanceObserver === 'function') {
  try {
    new PerformanceObserver((list) => list.getEntries().forEach((e) => check(e.name))).observe({ type: 'resource', buffered: true });
  } catch {
    /* unsupported entry type */
  }
}
