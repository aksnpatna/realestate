import puppeteer from 'puppeteer';

const reportIds = ['brisbane-growth', 'sydney-investment', 'melbourne-first-home', 'perth-regional', 'brisbane-schools'];

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  for (const reportId of reportIds) {
    console.log(`Testing ${reportId}...`);
    await page.goto('http://localhost:8082/?view=samples');
    await page.waitForSelector('.srl');
    
    // Click on the report
    const cards = await page.$$('.srl__grid .srl__card');
    const index = reportIds.indexOf(reportId);
    await cards[index].click();
    
    // Wait for report to load
    try {
      await page.waitForSelector('.sr', { timeout: 30000 });
      console.log(`✅ ${reportId} loaded successfully`);
      
      // Take screenshot
      await page.screenshot({ path: `${reportId}-report.png`, fullPage: true });
    } catch (error) {
      console.log(`❌ ${reportId} failed to load: ${error.message}`);
    }
  }
  
  await browser.close();
  console.log('All tests completed');
})();