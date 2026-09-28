import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  console.log('Navigating to samples page...');
  await page.goto('http://localhost:8082/?view=samples');
  
  console.log('Waiting for page to load...');
  await page.waitForSelector('.srl');
  
  console.log('Taking screenshot of samples page...');
  await page.screenshot({ path: 'samples-page.png', fullPage: true });
  
  console.log('Clicking on Brisbane growth report...');
  await page.click('.srl__grid .srl__card:first-child');
  
  console.log('Waiting for report to load...');
  await page.waitForSelector('.sr', { timeout: 30000 });
  
  console.log('Taking screenshot of report...');
  await page.screenshot({ path: 'brisbane-growth-report.png', fullPage: true });
  
  console.log('Checking for errors in console...');
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  if (errors.length > 0) {
    console.log('Errors in browser console:', errors);
  } else {
    console.log('No errors in browser console');
  }
  
  await browser.close();
  console.log('Test completed');
})();