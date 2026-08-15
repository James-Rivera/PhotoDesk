FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    U2NET_HOME=/models \
    NUMBA_CACHE_DIR=/tmp/numba

WORKDIR /service

RUN addgroup --system photodesk && adduser --system --ingroup photodesk photodesk \
    && mkdir -p /models && chown photodesk:photodesk /models

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY app ./app

USER photodesk
EXPOSE 7000

HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:7000/v1/health', timeout=4)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7000", "--proxy-headers", "--forwarded-allow-ips", "*"]
