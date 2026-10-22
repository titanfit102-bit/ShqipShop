FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 SHQIPSHOP_DB=/data/shop.db SHQIPSHOP_SECURE_COOKIES=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && useradd -r -u 10001 shop && mkdir /data && chown shop:shop /data
COPY --chown=shop:shop app/ ./app/
COPY --chown=shop:shop templates/ ./templates/
COPY --chown=shop:shop static/ ./static/
USER shop
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "127.0.0.1"]
