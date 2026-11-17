# Node API (all AI work happens in the RAG service).
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /srv
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN chown -R node:node /srv
USER node
EXPOSE 8000
CMD ["node", "server.js"]
