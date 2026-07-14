// Composites a board's card images into one simple grid collage — a
// lightweight "moodboard" export. Remote images are routed through
// api/proxy-image.js so the canvas can actually be read back afterwards
// (see that file for why); local photo cards are already data: URLs and
// load directly. Individual image failures are tolerated — the collage
// just uses whichever images loaded successfully.

const MAX_IMAGES = 12;
const GAP = 6;
const BG_COLOR = "#f5eedc";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}

function proxiedSrc(url) {
  return url.startsWith("data:") ? url : `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

// Mirrors CSS object-fit: cover — scales the image to fill the destination
// rect exactly, cropping whichever axis overflows.
function drawCover(ctx, img, dx, dy, dw, dh) {
  const imageRatio = img.width / img.height;
  const destRatio = dw / dh;
  let sx, sy, sw, sh;
  if (imageRatio > destRatio) {
    sh = img.height;
    sw = sh * destRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / destRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

export async function buildCollageBlob(cards, { size = 1080 } = {}) {
  const withImages = cards.filter((c) => c.image).slice(0, MAX_IMAGES);
  if (withImages.length === 0) {
    throw new Error("This board has no images to include yet.");
  }

  const results = await Promise.allSettled(withImages.map((c) => loadImage(proxiedSrc(c.image))));
  const images = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  if (images.length === 0) {
    throw new Error("Couldn't load any of this board's images.");
  }

  const cols = Math.ceil(Math.sqrt(images.length));
  const rows = Math.ceil(images.length / cols);
  const cellW = size / cols;
  const cellH = size / cols; // square cells, regardless of row count

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = Math.round(cellH * rows);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  images.forEach((img, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    drawCover(ctx, img, col * cellW + GAP / 2, row * cellH + GAP / 2, cellW - GAP, cellH - GAP);
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't generate the image."))), "image/png");
  });
}
