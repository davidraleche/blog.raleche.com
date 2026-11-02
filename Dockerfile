FROM node:20-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npx next build
ENV NODE_ENV=production
EXPOSE 8080
# The web service runs `next start`; the one-off setup job overrides the command with `npm run setup`.
CMD ["sh", "-c", "npx next start -p ${PORT:-8080}"]
