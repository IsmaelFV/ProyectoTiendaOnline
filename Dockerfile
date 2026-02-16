# ============================================
# Dockerfile - FashionMarket (Astro SSR + Node)
# Optimizado para Coolify
# ============================================

FROM node:20-alpine AS base
WORKDIR /app

# --- Fase de dependencias ---
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# --- Fase de build ---
FROM base AS build
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

# Variables de entorno necesarias en build time (Astro las incrusta en el bundle)
# Se pasan como build args desde Coolify
ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ARG STRIPE_SECRET_KEY
ARG STRIPE_WEBHOOK_SECRET
ARG NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
ARG NEXT_PUBLIC_CLOUDINARY_PRESET
ARG BREVO_API_KEY
ARG EMAIL_FROM
ARG CRON_SECRET

ENV PUBLIC_SUPABASE_URL=$PUBLIC_SUPABASE_URL
ENV PUBLIC_SUPABASE_ANON_KEY=$PUBLIC_SUPABASE_ANON_KEY
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
ENV STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
ENV STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET
ENV NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=$NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
ENV NEXT_PUBLIC_CLOUDINARY_PRESET=$NEXT_PUBLIC_CLOUDINARY_PRESET
ENV BREVO_API_KEY=$BREVO_API_KEY
ENV EMAIL_FROM=$EMAIL_FROM
ENV CRON_SECRET=$CRON_SECRET

RUN npm run build

# --- Fase de producción ---
FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Puerto que usa Astro standalone (default 4321)
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321

# Astro standalone genera un entry point en dist/server/entry.mjs
CMD ["node", "./dist/server/entry.mjs"]
