FROM pharmai/plip:latest

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3-pip python3-venv \
    && python3 -m venv --system-site-packages /opt/bindscope-venv \
    && /opt/bindscope-venv/bin/pip install --no-cache-dir fastapi==0.116.1 uvicorn==0.35.0 python-multipart==0.0.20 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /service
COPY app ./app
ENV PORT=10000 PYTHONUNBUFFERED=1 PYTHONPATH=/src:/service
EXPOSE 10000
ENTRYPOINT []
CMD ["/opt/bindscope-venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "10000", "--workers", "1"]
