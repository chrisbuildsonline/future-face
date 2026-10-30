FROM mcr.microsoft.com/playwright:v1.60.0-noble

RUN npm install -g bun@1.4.2

WORKDIR /app
COPY package.json bun.lock ./
COPY scripts/mediapipe-assets.ts scripts/
RUN bun install --frozen-lockfile
COPY . .

# Zero-key demo: with no YOUCAM_SECRET_KEY the app serves the recorded fixtures.
# The test suite is run by overriding this command (see scripts/docker-test.ts).
EXPOSE 3000
CMD ["sh", "-c", "bun run build && bun run start"]
