require('dotenv').config();

const BotArticles = require("./classes/BotArticles");

const botArticles = new BotArticles();

botArticles.start();
///////////DEV
function log(it, comments = "value: ") {
  console.log(comments, it);
}




