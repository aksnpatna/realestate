from playwright.sync_api import sync_playwright

def fetch_page(url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="networkidle")
        text = page.inner_text("body")
        browser.close()
        return text

print("--- PRICING ---")
print(fetch_page("https://developer.htagai.com/app/pricing"))
print("--- API REFERENCE ---")
print(fetch_page("https://developer.htagai.com/app/api-reference"))
