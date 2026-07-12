FROM python:3.11-slim
WORKDIR /app

ENV HF_HOME=/model-cache
ENV HF_HUB_DISABLE_PROGRESS_BARS=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install-deps chromium
RUN playwright install chromium
COPY . .
EXPOSE 8000

RUN python -c "from ai_sentiment import _load_transformer; _load_transformer()" || true

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--log-level", "warning"]
