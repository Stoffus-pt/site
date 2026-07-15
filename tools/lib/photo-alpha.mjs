import sharp from 'sharp';

const DEFAULTS = {
  colorThreshold: 42,
  blackThreshold: 28,
};

function maxRgb(data, i) {
  return Math.max(data[i], data[i + 1], data[i + 2]);
}

export function looksLikeBlackBackground(meta, data, info, opts = {}) {
  const blackThreshold = opts.blackThreshold ?? DEFAULTS.blackThreshold;
  const ch = info.channels;
  const w = info.width;
  const h = info.height;

  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];

  if (meta.hasAlpha) {
    let transparent = 0;
    for (let i = 0; i < data.length; i += ch) {
      if (ch === 4 && data[i + 3] < 16) transparent += 1;
    }
    if (transparent / (w * h) >= 0.12) {
      const cornersStillBlack = corners.every(([x, y]) => {
        const i = (y * w + x) * ch;
        const alpha = ch === 4 ? data[i + 3] : 255;
        return maxRgb(data, i) <= blackThreshold && alpha > 200;
      });
      if (!cornersStillBlack) return false;
    }
  }

  const cornersBlack = corners.every(([x, y]) => {
    const i = (y * w + x) * ch;
    return maxRgb(data, i) <= blackThreshold;
  });
  if (!cornersBlack) return false;

  let black = 0;
  for (let i = 0; i < data.length; i += ch) {
    if (maxRgb(data, i) <= blackThreshold) black += 1;
  }
  return black / (w * h) >= 0.28;
}

export function floodFillBlackFromEdges(rgba, width, height, blackThreshold = DEFAULTS.blackThreshold) {
  const out = Buffer.from(rgba);
  const visited = new Uint8Array(width * height);
  const queue = [];

  const isBlack = (x, y) => {
    const i = (y * width + x) * 4;
    return maxRgb(out, i) <= blackThreshold;
  };

  for (let x = 0; x < width; x += 1) {
    if (isBlack(x, 0)) queue.push([x, 0]);
    if (isBlack(x, height - 1)) queue.push([x, height - 1]);
  }
  for (let y = 0; y < height; y += 1) {
    if (isBlack(0, y)) queue.push([0, y]);
    if (isBlack(width - 1, y)) queue.push([width - 1, y]);
  }

  while (queue.length) {
    const [x, y] = queue.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const idx = y * width + x;
    if (visited[idx]) continue;
    if (!isBlack(x, y)) continue;
    visited[idx] = 1;
    const i = idx * 4;
    out[i + 3] = 0;
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return out;
}

export async function stripBlackBackground(input, opts = {}) {
  const blackThreshold = opts.blackThreshold ?? DEFAULTS.blackThreshold;
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rgba = floodFillBlackFromEdges(data, info.width, info.height, blackThreshold);

  return sharp(rgba, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

export async function maybeRemoveBlackBackground(input, opts = {}) {
  const rotated = sharp(input).rotate();
  const meta = await rotated.metadata();
  const { data, info } = await rotated.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  if (!looksLikeBlackBackground(meta, data, info, opts)) {
    return sharp(input)
      .rotate()
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
  }

  return stripBlackBackground(input, opts);
}

export async function polishTransparentPng(input, opts = {}) {
  const meta = await sharp(input).metadata();
  if (!meta.hasAlpha) return sharp(input).png().toBuffer();
  return stripBlackBackground(input, opts);
}
