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
from sqlalchemy.orm import sessionmaker
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
from models_v3 import SuburbRawV3, SessionLocal, engine

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
    """Extract a single suburb's REDUX_DATA payload via Playwright."""
    url_suburb = name.lower().replace(' ', '-')
    url = f"https://www.onthehouse.com.au/suburb/{state.lower()}/{url_suburb}-{postcode}"

    context = await browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        user_agent=(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/120.0.0.0 Safari/537.36'
        )
    )
    page = await context.new_page()
    await Stealth().apply_stealth_async(page)

    try:
        response = await page.goto(url, wait_until="domcontentloaded", timeout=45000)

        if response and response.status >= 400:
            err = f"HTTP {response.status}"
            await context.close()
            return "error", None, err

        # Allow DOM to settle — REDUX_DATA is server-rendered so minimal wait
        await page.wait_for_timeout(1500)

        html_content = await page.evaluate("document.documentElement.innerHTML")

        # Extract the REDUX_DATA payload
        match = re.search(
            r'window\.REDUX_DATA\s*=\s*(\{.*?\});\s*(?:window\.oth_device|</script>)',
            html_content,
            re.DOTALL
        )
        if not match:
            # Try alternative boundary
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
        await context.close()
        return "error", None, str(e)


async def worker(queue, browser, stats):
    """Worker coroutine: consumes jobs from queue, writes results to DB."""
    Session = sessionmaker(bind=engine)
    db = Session()
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

            # Update stats
            stats['processed'] += 1
            if status == 'complete':
                stats['success'] += 1
            elif status.startswith('error'):
                stats['errors'] += 1
            elif status == 'not_found':
                stats['not_found'] += 1

            remaining = queue.qsize()
            print(
                f"[{stats['processed']}/{stats['total']}] "
                f"{status:>12} | {name}, {state} {postcode} | "
                f"Remaining: {remaining}"
            )

            # Anti-blocking delay: 3s between each worker's requests
            await asyncio.sleep(3)
            queue.task_done()
    finally:
        db.close()


async def run_extraction(limit=BATCH_LIMIT):
    """Main extraction runner."""
    seed_raw_v3()

    db = SessionLocal()
    try:
        pending = (
            db.query(SuburbRawV3)
            .filter(SuburbRawV3.status == "pending")
            .order_by(SuburbRawV3.state, SuburbRawV3.name)
            .limit(limit)
            .all()
        )
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
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    asyncio.run(run_extraction(limit=limit))
