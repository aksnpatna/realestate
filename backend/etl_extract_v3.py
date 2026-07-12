"""
etl_extract_v3.py — Layer 1: RAW Extraction
============================================
Pulls window.REDUX_DATA from OnTheHouse using Playwright + Stealth.
Writes untouched JSON into suburbs_raw_v3 table.
Seeds suburbs from suburbs_all table (the authoritative list).
Extracts first 100 pending suburbs for pilot validation.
"""
import asyncio
import re
import json
import datetime
import os
import sys
import random
from dotenv import load_dotenv
from sqlalchemy.orm import sessionmaker
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
from models_v3 import SuburbRawV3, SessionLocal, engine

load_dotenv()
PROXY_URL = os.environ.get("PROXY_URL")

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:134.0) Gecko/20100101 Firefox/134.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
]
VIEWPORTS = [
    {'width': 1920, 'height': 1080},
    {'width': 1440, 'height': 900},
    {'width': 1366, 'height': 768},
    {'width': 1536, 'height': 864},
    {'width': 2560, 'height': 1440},
    {'width': 1680, 'height': 1050},
]

ACCEPT_LANGUAGES = [
    'en-AU,en;q=0.9',
    'en-AU,en-US;q=0.9,en;q=0.8',
    'en-GB,en;q=0.9',
    'en-US,en;q=0.9',
]

# Realistic seed cookies to simulate a returning visitor
SEED_COOKIES = [
    {'name': '_ga', 'value': f'GA1.2.{random.randint(1000000000,9999999999)}.{random.randint(1000000000,9999999999)}', 'domain': '.onthehouse.com.au', 'path': '/'},
    {'name': '_gid', 'value': f'GA1.2.{random.randint(100000000,999999999)}.{random.randint(1000000000,9999999999)}', 'domain': '.onthehouse.com.au', 'path': '/'},
    {'name': '_fbp', 'value': f'fb.1.{random.randint(1000000000000,9999999999999)}.{random.randint(1000000000,9999999999)}', 'domain': '.onthehouse.com.au', 'path': '/'},
]

TARGET_STATES = ['VIC', 'NSW', 'QLD', 'SA', 'TAS', 'WA']
EXCLUDED_STATES = ['NT']
BATCH_LIMIT = 100  # Pilot batch


def seed_raw_v3():
    """
    Seeds the raw_v3 table from the existing suburbs_all table.
    Preserves any already-completed entries so we don't re-scrape.
    Handles suburbs with special characters in names correctly.
    """
    db = SessionLocal()
    try:
        from parallel_scraper import SuburbAllModel

        existing = {r.id for r in db.query(SuburbRawV3.id).all()}
        all_subs = db.query(SuburbAllModel).all()

        to_insert = []
        skipped_nt = 0
        for s in all_subs:
            if s.state in EXCLUDED_STATES:
                skipped_nt += 1
                continue

            # Normalize ID: uppercase state + name (spaces→underscores, special chars stripped) + postcode
            safe_name = re.sub(r'[^A-Za-z0-9 ]', '', s.name).strip().upper().replace(' ', '_')
            v3_id = f"{s.state.upper()}_{safe_name}_{s.postcode}"

            if v3_id in existing:
                continue

            to_insert.append(SuburbRawV3(
                id=v3_id,
                state=s.state,
                name=s.name,
                postcode=s.postcode,
                status="pending",
                url=f"https://www.onthehouse.com.au/suburb/{s.state.lower()}/{s.name.lower().replace(' ','-')}-{s.postcode}"
            ))
            existing.add(v3_id)

        if to_insert:
            db.bulk_save_objects(to_insert)
            db.commit()
            print(f"Seeded {len(to_insert)} new suburbs into suburbs_raw_v3 ({skipped_nt} NT skipped).")
        else:
            print(f"No new suburbs to seed (table already populated).")
    finally:
        db.close()


async def extract_single_suburb(browser, db_id, state, name, postcode):
    """Extract a single suburb's REDUX_DATA payload via Playwright with anti-blocking measures."""
    url_suburb = name.lower().replace(' ', '-')
    url = f"https://www.onthehouse.com.au/suburb/{state.lower()}/{url_suburb}-{postcode}"

    extra_headers = {
        'Accept-Language': random.choice(ACCEPT_LANGUAGES),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'DNT': '1',
    }

    context_args = {
        'viewport': random.choice(VIEWPORTS),
        'user_agent': random.choice(USER_AGENTS),
        'extra_http_headers': extra_headers,
    }
    if PROXY_URL:
        context_args['proxy'] = {'server': PROXY_URL}

    context = await browser.new_context(**context_args)
    await context.add_cookies(SEED_COOKIES)
    page = await context.new_page()
    await Stealth().apply_stealth_async(page)

    async def block_assets(route):
        if route.request.resource_type in ["image", "stylesheet", "font", "media", "other"]:
            await route.abort()
        else:
            await route.continue_()

    await page.route("**/*", block_assets)

    # Retry loop with exponential backoff
    max_retries = 3
    last_error = None
    for attempt in range(max_retries):
        try:
            response = await page.goto(url, wait_until="domcontentloaded", timeout=45000)

            if response and response.status == 429:
                wait_s = (2 ** attempt) * 10 + random.uniform(1, 5)
                print(f"  Rate limited on {name} — backing off {wait_s:.0f}s (attempt {attempt+1}/{max_retries})")
                await asyncio.sleep(wait_s)
                last_error = f"HTTP 429 (attempt {attempt+1})"
                continue

            if response and response.status >= 400:
                err = f"HTTP {response.status}"
                await context.close()
                return "error", None, err

            # CAPTCHA detection
            captcha = await page.evaluate("""() => {
                return document.querySelector('[class*="cf-"], #challenge-stage, .g-recaptcha, #px-captcha') !== null ||
                       document.title.toLowerCase().includes('captcha') ||
                       document.title.toLowerCase().includes('attention required');
            }""")
            if captcha:
                await context.close()
                return "error_captcha", None, "CAPTCHA challenge detected — site may be defending against scraping"

            html_content = await page.evaluate("document.documentElement.innerHTML")

            match = re.search(
                r'window\.REDUX_DATA\s*=\s*(\{.*?\});\s*(?:window\.oth_device|</script>)',
                html_content,
                re.DOTALL
            )
            if not match:
                match = re.search(
                    r'window\.REDUX_DATA\s*=\s*(\{.*?\});',
                    html_content,
                    re.DOTALL
                )

            if match:
                json_str = match.group(1)
                try:
                    data = json.loads(json_str)
                    await context.close()
                    return "complete", data, None
                except json.JSONDecodeError as je:
                    await context.close()
                    return "error_parse", None, f"JSON parse error: {je}"
            else:
                await context.close()
                return "error_no_data", None, "REDUX_DATA payload not found in page HTML"

        except Exception as e:
            error_str = str(e)
            if attempt < max_retries - 1 and ('timeout' in error_str.lower() or 'net::' in error_str.lower()):
                wait_s = (2 ** attempt) * 5 + random.uniform(1, 3)
                print(f"  Network error on {name} — retrying in {wait_s:.0f}s (attempt {attempt+1}/{max_retries})")
                await asyncio.sleep(wait_s)
                last_error = error_str
                continue
            await context.close()
            return "error", None, error_str

    await context.close()
    return "error", None, last_error or "Max retries exceeded"


async def worker(queue, browser, stats):
    """Worker coroutine: consumes jobs from queue, writes results to DB with circuit breaker."""
    Session = sessionmaker(bind=engine)
    db = Session()
    consecutive_errors = 0
    MAX_CONSECUTIVE_ERRORS = 15
    try:
        while True:
            item = await queue.get()
            if item is None:
                break

            db_id, state, name, postcode = item
            status, data, error = await extract_single_suburb(browser, db_id, state, name, postcode)

            record = db.query(SuburbRawV3).filter(SuburbRawV3.id == db_id).first()
            if record:
                record.status = status
                record.error_log = error[:500] if error else None
                if data:
                    record.raw_json = data
                    record.raw_json_size = len(json.dumps(data))
                record.last_scraped = datetime.datetime.utcnow()
                db.commit()

            stats['processed'] += 1
            if status == 'complete':
                stats['success'] += 1
                consecutive_errors = 0
            elif status.startswith('error'):
                stats['errors'] += 1
                consecutive_errors += 1
            elif status == 'not_found':
                stats['not_found'] += 1
                consecutive_errors = 0

            # Circuit breaker: if too many consecutive errors, pause and warn
            if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                cooldown = 300 + random.uniform(0, 120)
                print(f"\n⚠️  CIRCUIT BREAKER: {consecutive_errors} consecutive errors — pausing {cooldown/60:.1f} minutes")
                stats['circuit_breaker'] = True
                await asyncio.sleep(cooldown)
                consecutive_errors = 0
                print(f"  → Resuming...\n")

            remaining = queue.qsize()
            print(
                f"[{stats['processed']}/{stats['total']}] "
                f"{status:>12} | {name}, {state} {postcode} | "
                f"Remaining: {remaining}"
            )

            jitter = random.uniform(2.5, 6.0)
            await asyncio.sleep(jitter)
            queue.task_done()
    finally:
        db.close()


async def run_extraction(limit=BATCH_LIMIT, scope="national"):
    """Main extraction runner."""
    seed_raw_v3()

    db = SessionLocal()
    try:
        pending_query = (
            db.query(SuburbRawV3)
            .filter(SuburbRawV3.status == "pending")
            .order_by(SuburbRawV3.state, SuburbRawV3.name)
        )
        
        if scope == "metro":
            from parallel_scraper import SuburbAllModel
            live_suburbs = db.query(SuburbAllModel).filter(SuburbAllModel.is_live == True).all()
            live_ids = []
            for s in live_suburbs:
                safe_name = re.sub(r'[^A-Za-z0-9 ]', '', s.name).strip().upper().replace(' ', '_')
                live_ids.append(f"{s.state.upper()}_{safe_name}_{s.postcode}")
            pending_query = pending_query.filter(SuburbRawV3.id.in_(live_ids))

        pending = pending_query.limit(limit).all()
    finally:
        db.close()

    if not pending:
        print("No pending suburbs to extract.")
        return

    print(f"\n{'='*60}")
    print(f"Starting extraction of {len(pending)} suburbs ({TARGET_STATES})")
    print(f"{'='*60}\n")

    queue = asyncio.Queue()
    for s in pending:
        queue.put_nowait((s.id, s.state, s.name, s.postcode))

    stats = {
        'total': len(pending),
        'processed': 0,
        'success': 0,
        'errors': 0,
        'not_found': 0
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--disable-dev-shm-usage', '--no-sandbox', '--disable-gpu']
        )

        # 3 concurrent workers — conservative anti-blocking strategy
        concurrency = 3
        workers_tasks = [
            asyncio.create_task(worker(queue, browser, stats))
            for _ in range(concurrency)
        ]

        await queue.join()

        # Signal workers to exit
        for _ in range(concurrency):
            await queue.put(None)
        await asyncio.gather(*workers_tasks)
        await browser.close()

    print(f"\n{'='*60}")
    print(f"Extraction Complete!")
    print(f"  Success:   {stats['success']}")
    print(f"  Errors:    {stats['errors']}")
    print(f"  Not Found: {stats['not_found']}")
    print(f"{'='*60}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Run V3 Extraction")
    parser.add_argument("--limit", type=int, default=100, help="Number of suburbs to process")
    parser.add_argument("--scope", type=str, choices=["metro", "national"], default="national", help="Scope of extraction: metro or national")
    args = parser.parse_args()
    
    asyncio.run(run_extraction(limit=args.limit, scope=args.scope))
