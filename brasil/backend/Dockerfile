FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
COPY --chown=node:node src ./src
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node server.mjs ./server.mjs
USER node
ENV HOST=0.0.0.0
EXPOSE 8080
CMD ["sh", "-c", "node src/migrate.mjs && node server.mjs"]
