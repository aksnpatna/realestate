#!/usr/bin/env python3
"""
Script to capture network requests from KIE chat playground by navigating directly to chat model.
"""

import asyncio
from playwright.async_api import async_playwright

async def capture_kie_api_requests():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Navigate directly to chat model's playground
        # Look for links like /playground/chat or /models/chat
        await page.goto("https://kie.ai/market")
        await page.wait_for_load_state("networkidle")
        
        # Extract all links from the page
        links = await page.eval_on_selector_all("a[href]", "anchors => anchors.map(anchor => anchor.href)")
        
        # Look for chat-related links
        chat_links = [link for link in links if "chat" in link.lower() or "playground" in link.lower()]
        print(f"Found {len(chat_links)} chat-related links:")
        for link in chat_links:
            print(f"  - {link}")
            
        # If we found any, try to navigate to the first one
        if chat_links:
            await page.goto(chat_links[0])
            await page.wait_for_load_state("networkidle")
            print(f"Navigated to: {chat_links[0]}")
        else:
            print("No chat-related links found, trying general playground")
            await page.goto("https://kie.ai/playground")
            
        # Wait for playground to load and send message
        try:
            await page.wait_for_selector('input[placeholder*="message"]', timeout=30000)
            print("Input field found")
            
            await page.fill('input[placeholder*="message"]', "Hello, what is 2+2?")
            await page.keyboard.press("Enter")
            print("Message sent")
            
            api_response = await page.wait_for_response(
                lambda r: "api.kie.ai" in r.url and r.request.method == "POST",
                timeout=30000
            )
            print(f"API call captured: {api_response.url}")
            
            request_body = await api_response.request.body()
            response_body = await api_response.text()
            
            print("Request body:")
            print(request_body.decode("utf-8"))
            print("\nResponse body:")
            print(response_body)
            
            with open("kie_chat_api_request.txt", "w", encoding="utf-8") as f:
                f.write(f"URL: {api_response.url}\n")
                f.write(f"Status: {api_response.status}\n")
                f.write("\nRequest Headers:\n")
                for name, value in api_response.request.headers.items():
                    f.write(f"{name}: {value}\n")
                f.write("\nRequest Body:\n")
                f.write(request_body.decode("utf-8"))
                f.write("\n\nResponse Headers:\n")
                for name, value in api_response.headers.items():
                    f.write(f"{name}: {value}\n")
                f.write("\nResponse Body:\n")
                f.write(response_body)
            print("\nAPI call saved to kie_chat_api_request.txt")
            
        except Exception as e:
            print(f"Error in playground: {e}")
            import traceback
            print(traceback.format_exc())
        
        await asyncio.sleep(5)
        await browser.close()

asyncio.run(capture_kie_api_requests())