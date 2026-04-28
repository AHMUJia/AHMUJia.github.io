FROM node:22-alpine

WORKDIR /app

# Install deps first for better Docker layer caching
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy server source
COPY *.js ./

ENV NODE_ENV=production
ENV SITE_DIR=/site
ENV DATA_DIR=/data
ENV PORT=3000

EXPOSE 3000

# /site and /data should be bind-mounted from the host. Default node user has
# UID 1000; ensure the host directories are owned accordingly, or override
# with `user: "0:0"` in compose if you need root for development.
USER node

CMD ["node", "server.js"]
