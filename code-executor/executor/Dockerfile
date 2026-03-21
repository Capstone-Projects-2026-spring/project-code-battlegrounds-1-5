FROM alpine:latest

# run with:
# sudo docker run --name test -p 8000:8000 -d --cap-add=SYS_ADMIN --security-opt seccomp=unconfined js-runner:latest

RUN apk add --no-cache \
    nsjail \
    python3 \
    py3-pip \
    py3-fastapi \
    ca-certificates

# install uvicorn via pip since py3-uvicorn may not be available in all alpine repos
RUN pip3 install --no-cache-dir uvicorn --break-system-packages

WORKDIR /app

COPY main.py /app/main.py
COPY rootfs /app/rootfs

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]