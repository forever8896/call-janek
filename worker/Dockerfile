FROM oven/bun:1.2-alpine

WORKDIR /app

# Install deps first for layer caching
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# App source
COPY . .

# Railway provides PORT at runtime via env
EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
