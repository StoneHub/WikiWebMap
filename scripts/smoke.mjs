import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4173';

async function waitForNodeCount(page, minimumCount) {
  await page.waitForFunction(
    (count) => {
      const body = document.body.innerText;
      const match = body.match(/Nodes:\s*(\d+)/);
      return match ? Number(match[1]) >= count : false;
    },
    minimumCount,
    { timeout: 30000 }
  );
}

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  await page.getByRole('textbox', { name: 'Search a Wikipedia topic' }).fill('Physics');
  await page.getByRole('button', { name: 'Start Exploration' }).click();
  await waitForNodeCount(page, 2);

  const physicsNode = page.locator('svg text').filter({ hasText: 'Physics' }).first();
  await physicsNode.click({ force: true });
  await page.getByRole('heading', { name: 'Physics' }).waitFor({ timeout: 15000 });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Run path/i }).first().click();
  await page.getByRole('button', { name: 'ABORT' }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'ABORT' }).click();
  await page.getByText('Search cancelled').waitFor({ timeout: 15000 });

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobilePage.goto(baseUrl, { waitUntil: 'networkidle' });
  await mobilePage.getByRole('button', { name: 'Open Ideas' }).click();
  await mobilePage.getByRole('button', { name: /Run path/i }).first().waitFor({ timeout: 15000 });
  await mobilePage.getByRole('button', { name: /Run path/i }).first().click();
  await mobilePage.getByRole('button', { name: 'ABORT' }).waitFor({ timeout: 15000 });
  await mobilePage.getByRole('button', { name: 'ABORT' }).click();
  await mobilePage.getByText('Search cancelled').waitFor({ timeout: 15000 });

  await page.close();
  await mobilePage.close();
} finally {
  await browser.close();
}
