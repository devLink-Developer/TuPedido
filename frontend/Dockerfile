FROM node:22-alpine

WORKDIR /app

COPY package.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts postcss.config.js tailwind.config.js index.html ./
COPY public ./public
COPY src ./src

RUN npm install

EXPOSE 8015

CMD ["npm", "run", "dev"]
