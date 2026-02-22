// Structured data (JSON-LD) and URL helpers for the SEO head. Pure functions, used at build time only.

export const SITE_NAME = 'Framelab';

export type JsonLd = Record<string, unknown>;

/** The absolute canonical URL of a route on the site, without a trailing slash (except the root). */
export function canonicalUrl(site: URL | string, pathname: string): string {
  const path = pathname.replace(/\/index\.html$/, '').replace(/(.)\/$/, '$1') || '/';
  return new URL(path, site).href;
}

/** schema.org SoftwareApplication for a tool page: a free web app that runs in the browser. */
export function softwareApplication(opts: { name: string; description: string; url: string }): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any (runs in a modern web browser)',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
    publisher: { '@type': 'Organization', name: SITE_NAME },
  };
}

/** schema.org FAQPage from question/answer pairs. */
export function faqPage(faq: Array<{ q: string; a: string }>): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/** schema.org HowTo from ordered steps. */
export function howTo(opts: { name: string; steps: string[] }): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: opts.name,
    totalTime: 'PT1M',
    estimatedCost: { '@type': 'MonetaryAmount', currency: 'USD', value: 0 },
    step: opts.steps.map((text, i) => ({ '@type': 'HowToStep', position: i + 1, name: `Step ${i + 1}`, text })),
  };
}

/** schema.org BreadcrumbList: Home, then the page. */
export function breadcrumbs(site: URL | string, trail: Array<{ name: string; path: string }>): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: canonicalUrl(site, item.path),
    })),
  };
}

/** Serialises JSON-LD for a <script type="application/ld+json"> block; "<" is escaped so no tag can close it. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
