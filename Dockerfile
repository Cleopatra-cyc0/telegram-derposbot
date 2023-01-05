# syntax=docker/dockerfile:1
FROM node:18-alpine
ENV NODE_ENV=development

ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT

WORKDIR /app

COPY package*.json ./
RUN npm install

ENV NODE_ENV=production

ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT

COPY . .

RUN npm run build

CMD ["node", "build/index.js"]
