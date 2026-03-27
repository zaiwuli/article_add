FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN set -ex && \
    sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources || true && \
    sed -i 's/main/main contrib non-free non-free-firmware/g' /etc/apt/sources.list.d/debian.sources || true && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        7zip \
        unrar \
        ca-certificates \
        tzdata && \
    ln -sf /usr/bin/7zz /usr/bin/7z && \
    pip install --no-cache-dir -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/ && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY app ./app

ENV DOCKER_ENV=true
ENV TZ="Asia/Shanghai"

CMD ["uvicorn", "app.api:app", "--host", "0.0.0.0", "--port", "8000","--log-level","error"]
