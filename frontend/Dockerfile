FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts postcss.config.js tailwind.config.js index.html ./
COPY public ./public
COPY src ./src

RUN npm ci
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8015
