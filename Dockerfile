FROM node:20-bullseye

WORKDIR /app

RUN apt-get update \
  && apt-get install -y python3 python3-pip postgresql-client \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

COPY . .

ENV NODE_ENV=development

EXPOSE 3000

CMD ["bash", "-c", "./scripts/setup_db.sh && npm run dev"]
