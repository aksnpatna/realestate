"""
Pre‑load HuggingFace transformer at container start.
Fails fast if model download/inference is broken.
"""
import os
import sys
import logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("preload")

os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "0" if sys.platform == "linux" else "0"

try:
    from ai_sentiment import _load_transformer, analyze_sentiment
    logger.info("Loading HuggingFace transformer model...")
    pipeline = _load_transformer()
    if pipeline:
        result = analyze_sentiment("testing the model warm up")
        logger.info(f"Warm‑up complete — model loaded successfully (test score: {result['score']})")
    else:
        logger.warning("Transformer not available — keyword fallback active")
except Exception as e:
    logger.warning(f"Transformer warm‑up failed ({e}) — keyword fallback will be used")
    logger.warning("This is non‑fatal; the API will start normally with keyword sentiment.")
