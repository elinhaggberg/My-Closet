// Vercel serverless function: given a URL, fetches its HTML server-side
// (the browser can't do this itself — most sites block cross-origin reads)
// and pulls out just enough to build a Pinterest-style card: title, image,
// description, price, site name. Nothing here is stored or logged — the
// function is stateless by design, so adding it doesn't compromise the
// "no data collection" premise of the app.

const TIMEOUT_MS = 8000;
const MAX_HTML_LENGTH = 700000;

function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function getMeta(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, "i");
  const match = html.match(re1) || html.match(re2);
  return match ? decodeEntities(match[1].trim()) : "";
}

// Same as getMeta, but collects every matching tag instead of just the
// first — some sites list a whole gallery as repeated og:image tags.
function getAllMeta(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "gi");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, "gi");
  const out = [];
  for (const m of html.matchAll(re1)) out.push(decodeEntities(m[1].trim()));
  for (const m of html.matchAll(re2)) out.push(decodeEntities(m[1].trim()));
  return out;
}

function getTitleTag(html) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? decodeEntities(match[1].trim()) : "";
}

function getLinkHref(html, rel) {
  const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re1 = new RegExp(`<link[^>]+rel=["']${escaped}["'][^>]*href=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<link[^>]+href=["']([^"']*)["'][^>]*rel=["']${escaped}["']`, "i");
  const match = html.match(re1) || html.match(re2);
  return match ? decodeEntities(match[1].trim()) : "";
}

// Some product pages tag their main image with schema.org microdata
// (itemprop="image") on a <meta> or directly on an <img>, instead of — or
// alongside — Open Graph tags.
function getItempropImage(html) {
  const re1 = /<(?:meta|img)[^>]+itemprop=["']image["'][^>]*(?:content|src)=["']([^"']*)["']/i;
  const re2 = /<(?:meta|img)[^>]+(?:content|src)=["']([^"']*)["'][^>]*itemprop=["']image["']/i;
  const match = html.match(re1) || html.match(re2);
  return match ? decodeEntities(match[1].trim()) : "";
}

function findPriceInJsonLd(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, raw] of scripts) {
    try {
      const data = JSON.parse(raw.trim());
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const found = searchForOffer(node);
        if (found) return found;
      }
    } catch {
      // Not valid JSON, or not the shape we expect — skip it.
    }
  }
  return null;
}

function searchForOffer(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 4) return null;
  const offers = node.offers || (node["@graph"] && node["@graph"]);
  if (offers) {
    const list = Array.isArray(offers) ? offers : [offers];
    for (const offer of list) {
      if (offer && offer.price) return { price: String(offer.price), currency: offer.priceCurrency || "" };
      const nested = searchForOffer(offer, depth + 1);
      if (nested) return nested;
    }
  }
  if (node.price) return { price: String(node.price), currency: node.priceCurrency || "" };
  for (const value of Object.values(node)) {
    if (value && typeof value === "object") {
      const nested = searchForOffer(value, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

function resolveUrl(maybeRelative, base) {
  if (!maybeRelative) return "";
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return "";
  }
}

// Product schema.org JSON-LD commonly lists a whole gallery under "image"
// (a string, or an array of strings/ImageObjects) — the most reliable
// source of multiple real product photos when a site provides it.
function findImagesInJsonLd(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const images = [];
  for (const [, raw] of scripts) {
    try {
      const data = JSON.parse(raw.trim());
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) collectImagesFromNode(node, images, 0);
    } catch {
      // Not valid JSON, or not the shape we expect — skip it.
    }
  }
  return images;
}

function collectImagesFromNode(node, out, depth) {
  if (!node || typeof node !== "object" || depth > 4) return;
  if (node.image) {
    const imgs = Array.isArray(node.image) ? node.image : [node.image];
    for (const img of imgs) {
      if (typeof img === "string") out.push(img);
      else if (img && typeof img === "object" && img.url) out.push(img.url);
    }
  }
  for (const value of Object.values(node)) {
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) value.forEach((v) => collectImagesFromNode(v, out, depth + 1));
    else collectImagesFromNode(value, out, depth + 1);
  }
}

// Last-resort fallback for pages with no structured gallery data: scan
// every <img> tag, preferring lazy-load attributes (many galleries put a
// low-res placeholder in src and the real photo in data-src/data-original)
// and filtering out obvious icons/logos/tracking pixels by filename
// keyword or a too-small declared width/height.
const IMG_JUNK_PATTERN = /(logo|icon|sprite|pixel|spacer|blank|placeholder|avatar|badge|loading|1x1)/i;
const MAX_IMG_TAGS_SCANNED = 400;

function findImgTagCandidates(html) {
  const candidates = [];
  const imgTags = html.match(/<img\s[^>]*>/gi) || [];
  for (const tag of imgTags.slice(0, MAX_IMG_TAGS_SCANNED)) {
    const src =
      tag.match(/\sdata-src=["']([^"']+)["']/i)?.[1] ||
      tag.match(/\sdata-original=["']([^"']+)["']/i)?.[1] ||
      tag.match(/\sdata-lazy-src=["']([^"']+)["']/i)?.[1] ||
      tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
    if (!src || src.startsWith("data:") || IMG_JUNK_PATTERN.test(src)) continue;
    const width = Number(tag.match(/\swidth=["']?(\d+)/i)?.[1] || 0);
    const height = Number(tag.match(/\sheight=["']?(\d+)/i)?.[1] || 0);
    if ((width && width < 100) || (height && height < 100)) continue;
    candidates.push(decodeEntities(src));
  }
  return candidates;
}

const MAX_IMAGES = 24;

// Combines every source, most-reliable first, resolving to absolute URLs
// and deduping along the way, capped at a sane count for a picker UI.
function collectImages(html, finalUrl) {
  const raw = [
    ...findImagesInJsonLd(html),
    ...getAllMeta(html, "og:image"),
    ...getAllMeta(html, "twitter:image"),
    getLinkHref(html, "image_src"),
    getItempropImage(html),
    ...findImgTagCandidates(html),
  ].filter(Boolean);
  const seen = new Set();
  const resolved = [];
  for (const src of raw) {
    const abs = resolveUrl(src, finalUrl);
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);
    resolved.push(abs);
    if (resolved.length >= MAX_IMAGES) break;
  }
  return resolved;
}

// Status codes sites commonly use to push back on non-browser requests —
// worth a clearer message than a generic "couldn't fetch" for these, since
// it's the site refusing rather than a network problem.
function messageForStatus(status) {
  if (status === 401 || status === 403 || status === 999) {
    return "Scraping isn't allowed on this site — it blocked the request.";
  }
  if (status === 429) {
    return "This site is rate-limiting automated requests — try again in a moment.";
  }
  if (status === 404) {
    return "That page wasn't found (404).";
  }
  if (status >= 500) {
    return "This site's server had an error, or is blocking automated requests.";
  }
  return `Couldn't fetch that page (HTTP ${status}).`;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const target = req.query.url;
  if (!target || typeof target !== "string") {
    res.status(400).json({ error: "Missing url parameter." });
    return;
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    res.status(400).json({ error: "That doesn't look like a valid URL." });
    return;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    res.status(400).json({ error: "Only http/https URLs are supported." });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MyClosetApp/1.0; +https://vercel.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      res.status(200).json({
        error: messageForStatus(response.status),
        title: "",
        image: "",
        images: [],
        description: "",
        price: "",
        currency: "",
        siteName: parsed.hostname,
        sourceUrl: parsed.toString(),
      });
      return;
    }

    let html = await response.text();
    if (html.length > MAX_HTML_LENGTH) html = html.slice(0, MAX_HTML_LENGTH);

    const finalUrl = response.url || parsed.toString();
    const title = getMeta(html, "og:title") || getTitleTag(html);
    const description = getMeta(html, "og:description") || getMeta(html, "description");
    const images = collectImages(html, finalUrl);
    const image = images[0] || "";
    const siteName = getMeta(html, "og:site_name") || parsed.hostname.replace(/^www\./, "");

    let price = getMeta(html, "product:price:amount") || getMeta(html, "og:price:amount");
    let currency = getMeta(html, "product:price:currency") || getMeta(html, "og:price:currency");
    if (!price) {
      const jsonLdOffer = findPriceInJsonLd(html);
      if (jsonLdOffer) {
        price = jsonLdOffer.price;
        currency = currency || jsonLdOffer.currency;
      }
    }

    // The page loaded (HTTP 200) but nothing at all could be extracted —
    // usually means the real content only appears after JavaScript runs
    // (this fetch never executes scripts), or the response was actually a
    // bot-check/consent page disguised as a normal 200.
    const foundNothing = !title && !image && !description;
    const result = {
      title,
      image,
      images,
      description,
      price: price || "",
      currency: currency || "",
      siteName,
      sourceUrl: finalUrl,
    };
    if (foundNothing) {
      result.error = "Couldn't find any details on this page — it may block scraping or need JavaScript to load its content.";
    } else if (!image) {
      result.notice = "Got the details, but no image was found on this page.";
    }
    res.status(200).json(result);
  } catch (err) {
    const message = err && err.name === "AbortError" ? "Timed out fetching that page." : "Couldn't fetch that link.";
    res.status(200).json({ error: message, title: "", image: "", images: [], description: "", price: "", currency: "", siteName: parsed.hostname, sourceUrl: parsed.toString() });
  } finally {
    clearTimeout(timeout);
  }
};
