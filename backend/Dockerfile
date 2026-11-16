# Node API. Python is included for the legacy question/grading scripts, which
# remain the fallback while RAG is disabled or a PDF is still being indexed.
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv \
 && rm -rf /var/lib/apt/lists/* \
 && python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" NODE_ENV=production

WORKDIR /srv
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN chown -R node:node /srv
USER node
EXPOSE 8000
CMD ["node", "server.js"]
