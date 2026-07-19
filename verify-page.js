const puppeteer = require('puppeteer');

async function verify() {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Capture console messages
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('error', err => console.error('PAGE ERROR:', err));

    // Disable font loading to speed up rendering
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('fonts.googleapis') || url.includes('fonts.gstatic')) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds for JS to run

    // Take screenshot
    await page.screenshot({ path: '/tmp/page-screenshot.png', fullPage: true });

    // Get text content
    const text = await page.evaluate(() => document.body.innerText);
    console.log('TEXT CONTENT:', text.substring(0, 300));

    // Check computed styles
    const styles = await page.evaluate(() => {
      const body = document.body;
      const computed = window.getComputedStyle(body);
      return {
        backgroundColor: computed.backgroundColor,
        color: computed.color,
        display: computed.display,
      };
    });

    console.log('\nComputed styles:', styles);

    // Check for key elements
    const hasLanding = await page.evaluate(() => !!document.querySelector('.landing'));
    const hasHeader = await page.evaluate(() => !!document.querySelector('.app-header'));

    console.log('\n✓ Landing div present:', hasLanding);
    console.log('✓ Header present:', hasHeader);
    console.log('✓ Screenshot saved to /tmp/page-screenshot.png');

    await browser.close();
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verify();
