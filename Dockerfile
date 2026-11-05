FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=development
ENV DATABASE_URL=postgresql://clientflow:clientflow_dev_password@postgres:5432/clientflow?schema=public
ENV AUTH_SECRET=ClientFlowLocalDockerSecret-Change-Me-123456
ENV AUTH_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV CLIENTFLOW_LOCAL_STORAGE_DIR=/app/.clientflow-storage

RUN npm run db:generate

EXPOSE 3000

CMD ["sh", "-c", "npm run db:deploy && npm run db:seed && npm run dev -- --hostname 0.0.0.0"]
