import puppeteer from 'puppeteer';
import { execFileSync } from 'child_process';
import { readFileSync, mkdirSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, '../assets');

const demos = [
  { svg: 'demo-syntax.svg', gif: 'demo-syntax.gif', duration: 6000, frames: 30 },
  { svg: 'demo-completions.svg', gif: 'demo-completions.gif', duration: 7000, frames: 35 },
  { svg: 'demo-hover.svg', gif: 'demo-hover.gif', duration: 4000, frames: 20 },
];

async function generateGif(browser, demo) {
  const { svg, gif, duration, frames } = demo;
  const svgPath = resolve(assetsDir, svg);
  const gifPath = resolve(assetsDir, gif);
  const tmpDir = resolve(assetsDir, '.tmp-frames');

  mkdirSync(tmpDir, { recursive: true });

  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 400, deviceScaleFactor: 2 });

  const svgContent = readFileSync(svgPath, 'utf-8');
  const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; }
  body { width: 800px; height: 400px; overflow: hidden; background: #1e1e1e; }
</style></head>
<body>${svgContent}</body></html>`;

  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  const interval = duration / frames;

  const framePaths = [];
  const delays = [];

  for (let i = 0; i < frames; i++) {
    await new Promise(r => setTimeout(r, interval));

    const framePath = resolve(tmpDir, `frame-${String(i).padStart(4, '0')}.png`);
    await page.screenshot({ path: framePath, clip: { x: 0, y: 0, width: 800, height: 400 } });
    framePaths.push(framePath);
    delays.push(Math.round(interval / 10)); // GIF delay in 1/100s
  }

  // Hold the last frame longer
  delays[delays.length - 1] = 300;

  await page.close();

  // Build magick args: -delay N frame.png -delay M frame2.png ...
  const magickArgs = [];
  for (let i = 0; i < framePaths.length; i++) {
    magickArgs.push('-delay', String(delays[i]), framePaths[i]);
  }
  magickArgs.push('-loop', '0', '-layers', 'Optimize', gifPath);

  execFileSync('magick', magickArgs);

  // Cleanup
  rmSync(tmpDir, { recursive: true, force: true });

  console.log(`Generated: ${gif}`);
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const demo of demos) {
    await generateGif(browser, demo);
  }

  await browser.close();
  console.log('All GIFs generated!');
}

main().catch(console.error);
