"""
http_client.py — Hardened external HTTP fetcher with backoff, jitter, concurrency caps,
and a centralised source registry.

All external fetchers (OnTheHouse, Domain, CoreLogic, ABS, data.gov.au) MUST
use this module. No inline requests.get / urllib calls allowed.
"""
import time
import random
import logging
import threading
from dataclasses import dataclass, field
from typing import Optional
from urllib.robotparser import RobotFileParser
from urllib.parse import urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


logger = logging.getLogger("uvicorn")


class FetchError(Exception):
    """Structured error for external fetch failures."""

    def __init__(self, source: str, url: str, status: Optional[int], attempts: int, reason: str = ""):
        self.source = source
        self.url = url
        self.status = status
        self.attempts = attempts
        self.reason = reason
        super().__init__(f"[{source}] {url} → HTTP {status} after {attempts} attempts: {reason}")


@dataclass
class SourceConfig:
    base_url: str
    user_agent: str = (
        "RealEstateEngine/1.0 (research data collection; "
        "contact@example.com)"
    )
    concurrency: int = 2
    robots_check: bool = True
    crawl_delay: float = 1.0
    allowed_paths: list = field(default_factory=lambda: ["/"])
    disallowed_paths: list = field(default_factory=list)
    robots_cache_ttl: int = 86400


# ---------------------------------------------------------------
# Source registry — add every external target here
# ---------------------------------------------------------------
REGISTRY: dict[str, SourceConfig] = {
    "onthehouse": SourceConfig(
        base_url="https://www.onthehouse.com.au",
        concurrency=2,
        crawl_delay=2.0,
        robots_check=False,  # POC — known scraper posture; see scraping policy
    ),
    "abs": SourceConfig(
        base_url="https://api.data.abs.gov.au",
        concurrency=4,
        robots_check=False,
        user_agent="RealEstateEngine/1.0 (ABS public data)",
    ),
    "data_gov_au": SourceConfig(
        base_url="https://data.gov.au",
        concurrency=4,
        robots_check=False,
    ),
    "rba": SourceConfig(
        base_url="https://www.rba.gov.au",
        concurrency=2,
        crawl_delay=3.0,
        robots_check=True,
    ),
}

# Per-source concurrency semaphores
_semaphores: dict[str, threading.BoundedSemaphore] = {}


def _get_semaphore(source: str) -> threading.BoundedSemaphore:
    if source not in _semaphores:
        cfg = REGISTRY.get(source, SourceConfig(base_url=""))
        _semaphores[source] = threading.BoundedSemaphore(cfg.concurrency)
    return _semaphores[source]


# Session pooling
_session: Optional[requests.Session] = None
_session_lock = threading.Lock()


def _get_session() -> requests.Session:
    global _session
    if _session is None:
        with _session_lock:
            if _session is None:
                retry_strategy = Retry(
                    total=3,
                    backoff_factor=0.5,
                    status_forcelist=[429, 500, 502, 503, 504],
                    allowed_methods=["GET"],
                )
                adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=8, pool_maxsize=8)
                _session = requests.Session()
                _session.mount("https://", adapter)
                _session.mount("http://", adapter)
    return _session


def get_with_backoff(
    url: str,
    *,
    source: str = "default",
    retries: int = 5,
    base_delay: float = 1.0,
    jitter: float = 0.3,
    timeout: int = 20,
    respect_retry_after: bool = True,
    headers: Optional[dict] = None,
    **kwargs,
) -> requests.Response:
    cfg = REGISTRY.get(source)
    if cfg is None:
        cfg = SourceConfig(base_url=urlparse(url).netloc)

    sem = _get_semaphore(source)
    acquired = sem.acquire(timeout=30)
    if not acquired:
        raise FetchError(source, url, None, 0, "concurrency semaphore timeout")

    try:
        session = _get_session()
        req_headers = {"User-Agent": cfg.user_agent}
        if headers:
            req_headers.update(headers)

        last_exc = None
        last_status = None

        for attempt in range(1, retries + 1):
            try:
                resp = session.get(url, headers=req_headers, timeout=timeout, **kwargs)

                if resp.status_code == 429 and respect_retry_after:
                    retry_after = resp.headers.get("Retry-After", "")
                    if retry_after.isdigit():
                        delay = float(retry_after)
                    else:
                        delay = base_delay * (2 ** (attempt - 1)) + random.uniform(0, jitter)
                    logger.warning("http_client_429 source=%s url=%s attempt=%d retry_after=%s", source, url, attempt, retry_after)
                    if attempt < retries:
                        time.sleep(delay)
                        continue

                if 200 <= resp.status_code < 300:
                    return resp

                last_status = resp.status_code
                if resp.status_code >= 500 or resp.status_code == 429:
                    delay = base_delay * (2 ** (attempt - 1)) + random.uniform(0, jitter)
                    logger.warning("http_client_retry source=%s url=%s status=%d attempt=%d", source, url, resp.status_code, attempt)
                    if attempt < retries:
                        time.sleep(delay)
                        continue
                else:
                    raise FetchError(source, url, resp.status_code, attempt, f"client error {resp.status_code}")

            except requests.Timeout as e:
                last_exc = e
                delay = base_delay * (2 ** (attempt - 1)) + random.uniform(0, jitter)
                logger.warning("http_client_timeout source=%s url=%s attempt=%d", source, url, attempt)
                if attempt < retries:
                    time.sleep(delay)
                    continue
            except requests.ConnectionError as e:
                last_exc = e
                delay = base_delay * (2 ** (attempt - 1)) + random.uniform(0, jitter)
                logger.warning("http_client_connection source=%s url=%s attempt=%d", source, url, attempt)
                if attempt < retries:
                    time.sleep(delay)
                    continue

        raise FetchError(source, url, last_status, retries, str(last_exc or ""))

    finally:
        sem.release()


def fetch_json(url: str, *, source: str = "default", **kwargs):
    resp = get_with_backoff(url, source=source, **kwargs)
    return resp.json()


def can_fetch(source: str, path: str = "/") -> bool:
    """Check robots.txt permission for a source+path."""
    cfg = REGISTRY.get(source)
    if cfg is None or not cfg.robots_check:
        return True
    robots_url = f"{cfg.base_url.rstrip('/')}/robots.txt"
    robots_key = f"robots:{source}"
    rp = _robots_cache.get(robots_key)
    if rp is None:
        rp = RobotFileParser()
        rp.set_url(robots_url)
        try:
            rp.read()
            _robots_cache[robots_key] = rp
        except Exception:
            return True
    agent = cfg.user_agent.split("/")[0] if "/" in cfg.user_agent else "*"
    return rp.can_fetch(agent, path)


_robots_cache: dict = {}
