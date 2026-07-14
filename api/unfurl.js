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

function getTitleTag(html) {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
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
      res.status(200).json({ title: "", image: "", description: "", price: "", currency: "", siteName: parsed.hostname, sourceUrl: parsed.toString() });
      return;
    }

    let html = await response.text();
    if (html.length > MAX_HTML_LENGTH) html = html.slice(0, MAX_HTML_LENGTH);

    const finalUrl = response.url || parsed.toString();
    const title = getMeta(html, "og:title") || getTitleTag(html);
    const description = getMeta(html, "og:description") || getMeta(html, "description");
    const image = resolveUrl(getMeta(html, "og:image") || getMeta(html, "twitter:image"), finalUrl);
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

    res.status(200).json({
      title,
      image,
      description,
      price: price || "",
      currency: currency || "",
      siteName,
      sourceUrl: finalUrl,
    });
  } catch (err) {
    const message = err && err.name === "AbortError" ? "Timed out fetching that page." : "Couldn't fetch that link.";
    res.status(200).json({ error: message, title: "", image: "", description: "", price: "", currency: "", siteName: parsed.hostname, sourceUrl: parsed.toString() });
  } finally {
    clearTimeout(timeout);
  }
};
