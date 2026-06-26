import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');

const input = resolve(__dirname, '../assets-src/hero.mp4');
const framesDir = resolve(__dirname, 'public/frames');
const mobileDir = resolve(__dirname, 'public/frames-mobile');

if (!existsSync(framesDir)) mkdirSync(framesDir, { recursive: true });
if (!existsSync(mobileDir)) mkdirSync(mobileDir, { recursive: true });

const run = (args, label) => {
  console.log(`\n[${label}] Running ffmpeg...`);
  execFileSync(ffmpeg, args, { stdio: 'inherit' });
  console.log(`[${label}] Done.`);
};

// Desktop: 150 frames at 1920px wide, fps=15, quality 3
run([
  '-y', '-i', input,
  '-vf', 'fps=15,scale=1920:-2',
  '-q:v', '3',
  '-frames:v', '150',
  `${framesDir}/frame_%04d.jpg`
], 'desktop');

// Mobile: 75 frames at 960px wide, fps=8, quality 4
run([
  '-y', '-i', input,
  '-vf', 'fps=8,scale=960:-2',
  '-q:v', '4',
  '-frames:v', '75',
  `${mobileDir}/frame_%04d.jpg`
], 'mobile');

// Poster: first frame at 1920px
run([
  '-y', '-i', input,
  '-vf', 'select=eq(n\\,0),scale=1920:-2',
  '-q:v', '3',
  '-frames:v', '1',
  `${framesDir}/poster.jpg`
], 'poster');

console.log('\nAll frames extracted successfully.');
