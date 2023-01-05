# syntax=docker/dockerfile:1
FROM node:18 AS build
ENV NODE_ENV=development

WORKDIR /app

COPY package*.json ./
RUN npm install

ENV NODE_ENV=production

ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT

COPY . .

RUN npm run build

FROM node:18-alpine

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/build ./build

CMD ["node", "build/index.js"]
