/**
 * Generate icon-192.png and icon-512.png from logo.svg using sharp.
 * Run: node /home/z/my-project/scripts/gen-icons.js
 */
const fs = require("fs");
const sharp = require("sharp");

const SVG_PATH = "/home/z/my-project/public/logo.svg";
const OUT_192 = "/home/z/my-project/public/icons/icon-192.png";
const OUT_512 = "/home/z/my-project/public/icons/icon-512.png";

(async () => {
  const svgBuf = fs.readFileSync(SVG_PATH);
  const svgStr = svgBuf.toString("utf-8");

  // Extract inner SVG content (between <svg ...> and </svg>)
  const innerStart = svgStr.indexOf("<svg");
  const innerEnd = svgStr.lastIndexOf("</svg>");
  const inner = svgStr
    .slice(innerStart, innerEnd + 6)
    .replace(/<svg[^>]*viewBox="0 0 120 120"[^>]*>/, "<g>")
    .replace(/<\/svg>\s*$/, "</g>");

  // Maskable icons need padding (safe zone ~80% in center) + background fill
  // iOS prefers full-bleed background + logo centered at 85-90% size
  const wrap = (size) => Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="#FBF3E4"/>
      <rect width="${size}" height="${size}" fill="url(#bgGrad)"/>
      <defs>
        <radialGradient id="bgGrad" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stop-color="#F4C77B" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#D65430" stop-opacity="0.1"/>
        </radialGradient>
      </defs>
      <g transform="translate(${size * 0.1}, ${size * 0.1}) scale(${size * 0.8 / 120})">
        ${inner}
      </g>
    </svg>`
  );

  // Remove old fake PNGs
  if (fs.existsSync(OUT_192)) fs.unlinkSync(OUT_192);
  if (fs.existsSync(OUT_512)) fs.unlinkSync(OUT_512);

  // Generate real PNGs (render at high density for crisp edges, then resize to exact dimensions)
  await sharp(wrap(192), { density: 384 }).resize(192, 192).png().toFile(OUT_192);
  await sharp(wrap(512), { density: 1024 }).resize(512, 512).png().toFile(OUT_512);

  // Verify
  const s192 = fs.statSync(OUT_192);
  const s512 = fs.statSync(OUT_512);
  const meta192 = await sharp(OUT_192).metadata();
  const meta512 = await sharp(OUT_512).metadata();
  console.log("✓ icon-192.png:", s192.size, "bytes, format:", meta192.format, `${meta192.width}x${meta192.height}`);
  console.log("✓ icon-512.png:", s512.size, "bytes, format:", meta512.format, `${meta512.width}x${meta512.height}`);
})().catch((err) => {
  console.error("✗ Generation failed:", err);
  process.exit(1);
});
