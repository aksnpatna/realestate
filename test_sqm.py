import requests, os, re

def check(url):
    proxy = "http://q2y7f0i1h3:a6p0c1t5u4@au.smartproxy.com:20001"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        r = requests.get(url, headers=headers, proxies={"http": proxy, "https": proxy}, timeout=10)
        has_var = bool(re.search(r"var\s+data\s*=", r.text))
        has_json = bool(re.search(r"\[\s*\{\s*\"date\"\s*:\s*\".*?\}\s*\]", r.text))
        print(f"{url}: status={r.status_code}, var_data={has_var}, json_array={has_json}")
    except Exception as e:
        print(f"{url}: ERROR {e}")

check("https://sqmresearch.com.au/weekly-rents.php?postcode=6164&t=1")
check("https://sqmresearch.com.au/total-property-listings.php?postcode=6164&t=1")
check("https://sqmresearch.com.au/weekly-asking-property-prices.php?postcode=6164&t=1")
check("https://sqmresearch.com.au/graph_vacancy.php?postcode=6164&t=1")
