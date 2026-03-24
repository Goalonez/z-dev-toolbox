FROM node:24.14.0-alpine AS builder

WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm build:web

FROM nginx:1.27-alpine AS runtime

COPY .docker/nginx-web.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
