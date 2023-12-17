# Use of the official image of Node.js
FROM node:18

# setting root folder in the container
WORKDIR /app

# coping files package.json and package-lock.json in to the container
COPY package*.json ./

# install dependencies
#RUN npm install
# For strict correspondence to dependencies
RUN npm ci

# coping the rest files in to the container
COPY . .

# open port, for the comunication with the telegram-bot
ENV PORT=3000
EXPOSE $PORT

# run the app in the container
CMD [ "npm", "start" ]