FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
WORKDIR /app
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_STRIPE_PRICING_TABLE_ID
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_STRIPE_CUSTOMER_PORTAL_URL
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_STRIPE_PRICING_TABLE_ID=$VITE_STRIPE_PRICING_TABLE_ID
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY
ENV VITE_STRIPE_CUSTOMER_PORTAL_URL=$VITE_STRIPE_CUSTOMER_PORTAL_URL
COPY . .
RUN npm run build:all

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache dumb-init
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/build ./build
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/migrations ./server/migrations
USER node
EXPOSE 8080
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "build/server/index.js"]
