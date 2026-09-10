#!/usr/bin/env python3
"""
Script to extract text from the KIE market page screenshot.
"""

import pytesseract
from PIL import Image

try:
    # Open the image
    img = Image.open('kie_market_page.png')
    
    # Extract text using Tesseract OCR
    text = pytesseract.image_to_string(img)
    
    # Print the extracted text
    print("Extracted text from KIE market page:")
    print("=" * 50)
    print(text)
    
    # Save to file
    with open('kie_market_page.txt', 'w', encoding='utf-8') as f:
        f.write(text)
    print("\nText saved to kie_market_page.txt")
    
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
    print("Make sure you have tesseract-ocr installed: sudo apt install tesseract-ocr")