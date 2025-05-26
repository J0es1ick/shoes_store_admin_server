FROM node:20.19.1-alpine
WORKDIR /ap
RUN corepack enable
COPY ./package.json ./
COPY ./yarn.lock ./
RUN yarn
COPY ./ ./
ENTRYPOINT yarn run start:dev