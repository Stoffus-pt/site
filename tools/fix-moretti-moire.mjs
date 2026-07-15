import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

const input =
  process.argv[2] ||
  'C:\\Users\\User\\.cursor\\projects\\c-Users-User-Desktop-Stoffus-3D\\assets\\c__Users_User_AppData_Roaming_Cursor_User_workspaceStorage_b47c9541a79c4a1aeea338ca7311988a_images_Moretti_2_assentos_0.33x-dc5d2f84-f39a-433c-b69d-06170c7f2769.png';

const meta = await sharp(input).metadata();
const targetW = meta.width;
const targetH = meta.height;

const processed = await sharp(input)
  .rotate()
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();

const outputs = [
  join(root, 'site', 'assets', 'photos', 'models', 'moretti-1.png'),
  join(root, 'assets', 'photos', 'models', 'moretti-1.png'),
];

for (const out of outputs) {
  mkdirSync(dirname(out), { recursive: true });
  await sharp(processed).toFile(out);
  console.log('OK', out);
}

const smW = 420;
const smH = Math.round((targetH / targetW) * smW);
const mdW = 720;
const mdH = Math.round((targetH / targetW) * mdW);

const variants = [
  { name: 'sm', w: smW, h: smH },
  { name: 'md', w: mdW, h: mdH },
];

for (const variant of variants) {
  const buffer = await sharp(processed)
    .resize(variant.w, variant.h, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  for (const base of ['site', '']) {
    const out = join(root, base, 'assets', 'photos', 'models', `moretti-1-${variant.name}.png`);
    mkdirSync(dirname(out), { recursive: true });
    await sharp(buffer).toFile(out);
    console.log('OK', out);
  }
}

console.log(`Fonte: ${targetW}x${targetH} (+ sm ${smW}x${smH}, md ${mdW}x${mdH})`);
