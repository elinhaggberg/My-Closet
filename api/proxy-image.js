// Vercel serverless function: fetches an image URL server-side and relays
// the raw bytes from our own domain. This exists solely so the client-side
// moodboard collage (js/collage.js) can draw board images onto a <canvas>
// and still export it — drawing a cross-origin image onto a canvas taints
// it for readback (toDataURL/toBlob throws) unless the source server sends
// permissive CORS headers, which most retailer CDNs don't. Routing through
// our own domain sidesteps that regardless of the source site's policy.
// Nothing here is stored or logged — stateless, same as api/unfurl.js.

const TIMEOUT_MS = 8000;
const MAX_BYTES = 6 * 1024 * 1024; // 6MB — comfortably under Vercel's response size limit

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
        Accept: "image/*",
      },
    });

    if (!response.ok) {
      res.status(502).json({ error: `Source returned HTTP ${response.status}.` });
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      res.status(415).json({ error: "That URL didn't return an image." });
      return;
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_BYTES) {
      res.status(413).json({ error: "Image is too large." });
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      res.status(413).json({ error: "Image is too large." });
      return;
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).send(buffer);
  } catch (err) {
    const message = err && err.name === "AbortError" ? "Timed out fetching that image." : "Couldn't fetch that image.";
    res.status(502).json({ error: message });
  } finally {
    clearTimeout(timeout);
  }
};
