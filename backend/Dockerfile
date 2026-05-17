FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

EXPOSE 8016

CMD ["sh", "-c", "gunicorn app.main:app --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8016 --workers ${WEB_CONCURRENCY:-2} --timeout ${WEB_TIMEOUT:-60} --graceful-timeout ${WEB_GRACEFUL_TIMEOUT:-30} --keep-alive ${WEB_KEEP_ALIVE:-5} --forwarded-allow-ips='*' --access-logfile - --error-logfile -"]
