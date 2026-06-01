FROM node:20-alpine
WORKDIR /app

COPY api/package*.json ./api/
RUN npm install --prefix ./api

COPY . .

EXPOSE 3000
CMD ["node", "api/server.js"]
