FROM mcr.microsoft.com/devcontainers/javascript-node:1-20-bookworm

# Update and upgrade apt packages
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get autoremove -y

# Install corepack
#RUN npm i -g corepack
# actually not necessary with the js container

# Install bun
RUN curl -fsSL https://bun.sh/install | bash

CMD ["bash"]