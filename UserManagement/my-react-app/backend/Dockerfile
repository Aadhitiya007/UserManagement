
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

RUN mkdir -p uploads/products \
    && chown -R node:node /app

ENV NODE_ENV=production

USER node

EXPOSE 5000

CMD ["npm", "start"]
