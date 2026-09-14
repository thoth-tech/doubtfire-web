FROM node:22.23.2-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5

# The upstream image ships npm 10.9.8. Upgrade to the latest Node 22-compatible
# npm 11 release to pick up patched bundled dependencies before dropping
# privileges.
RUN npm install --global npm@11.19.1 \
  && npm cache clean --force

ENV DEBIAN_FRONTEND=noninteractive
ENV USER=node
ENV NODE_ENV=docker

# You can not use `${USER}` here, but reference `/home/node`.
ENV PATH="/home/node/.npm-global/bin:${PATH}"
# 👉 The `--global` install dir
ENV NPM_CONFIG_PREFIX="/home/node/.npm-global"

EXPOSE 4200

USER "${USER}"

# Pre-create the target dir for global install.
RUN mkdir -p "${NPM_CONFIG_PREFIX}/lib"

WORKDIR /doubtfire-web

# Copy in resources
COPY --chown="${USER}":root . .

# Setup within container
RUN npm ci --force --include=optional

EXPOSE 9876

# Install on launch so that bind-mounted source and node_modules stay current.
CMD ["/bin/bash", "-c", "npm install && exec npm start"]
