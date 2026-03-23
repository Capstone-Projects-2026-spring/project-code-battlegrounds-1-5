FROM alpine:latest

# run with:
# docker run -d -p 8000:8000 --cap-add=SYS_ADMIN --security-opt seccomp=unconfined runner:latest

RUN apk add --no-cache \
    nsjail \
    python3 \
    py3-pip \
    py3-fastapi \
    ca-certificates

# install uvicorn via pip since py3-uvicorn may not be available in all alpine repos
RUN pip3 install --no-cache-dir uvicorn --break-system-packages

# create an unprivileged user/group with fixed UID/GID so nsjail isn't root in the global namespace
RUN addgroup -g 99999 runner && adduser -D -H -u 99999 -G runner runner && chmod 1777 /tmp

WORKDIR /app

COPY main.py /app/main.py
COPY rootfs /app/rootfs

# ensure app files are readable by the non-root user
RUN chown -R runner:runner /app

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# drop root privileges for the app process
USER runner:runner

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]