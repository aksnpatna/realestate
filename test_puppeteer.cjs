const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:8082');
  
  await new Promise(r => setTimeout(r, 2000));
  
  await page.type('input[type="email"]', 'test123456@example.com');
  await page.type('input[type="password"]', 'TestPassword123!');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2000));
  
  await page.type('input', 'Point Cook');
  await new Promise(r => setTimeout(r, 1000));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  
  await new Promise(r => setTimeout(r, 3000));
  
  const preText = await page.evaluate(() => {
    const pres = Array.from(document.querySelectorAll('pre'));
    return pres.map(p => p.innerText);
  });
  
  console.log("PRE TAGS:", preText);
  await browser.close();
})();
