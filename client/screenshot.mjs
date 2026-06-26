import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

// Home hero
await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: 'ss-home-hero.png' });

// Home - About section
await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 4.2, behavior: 'instant' }));
await page.waitForTimeout(600);
await page.screenshot({ path: 'ss-home-about.png' });

// Home - Services section
await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 5.5, behavior: 'instant' }));
await page.waitForTimeout(600);
await page.screenshot({ path: 'ss-home-services.png' });

// Home - Contact section
await page.evaluate(() => {
  const el = document.getElementById('contact');
  if (el) el.scrollIntoView();
});
await page.waitForTimeout(600);
await page.screenshot({ path: 'ss-home-contact.png' });

// Why Choose Us
await page.goto('http://localhost:5174/why-choose-us', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'ss-why.png' });

// Gallery
await page.goto('http://localhost:5174/gallery', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'ss-gallery.png' });

// Careers
await page.goto('http://localhost:5174/careers', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'ss-careers.png' });

await browser.close();
console.log('Done.');
