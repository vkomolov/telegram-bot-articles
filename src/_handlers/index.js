const {
  regularKeys, keyboard_initial, get_inline_keyboard, initialData, actionTypes
} = require("../config");
const Article = require("../models/article.model");
const Topic = require("../models/topic.model");
const User = require("../models/user.model");
//const { mainMenu, topicsMenu } = keyboard_initial;
const { splitArrBy } = require("../_utils");


module.exports = {
  handleRegularKeys,
  handleMessages,
  handleQuery
};

async function handleMessages(bot, msg, params = {}) {
  try {
    let topicsCollection = bot?.topicsCollection || [];

    //const msgId = msg.message_id; //for deleting previous messages
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const parse_mode = "Markdown";

    if (msg.text.startsWith("/start")) {
      await checkAndGreetUser(bot, msg, {});
    }
    else {
      const botTopicsCollection = bot?.topicsCollection || [];
      if (!botTopicsCollection.length) {
        const collection = await Topic.getCollection({
          showBy: {
            name: 1,
            typeId: 1
          }
        });

        bot.topicsCollection = [...collection];
      }

      const topicsKeys = bot.topicsCollection.map(({ name }) => name);
      const topicKeyboardCombined = splitArrBy(topicsKeys, 2);

      const topicFound = findTopicByProp("name", msg.text, topicsCollection);

      if (topicFound) {
        const { typeId } = topicFound;

        const articlesByTypeId = await Article.find({ typeId });

        if (articlesByTypeId.length) {
          const user = await User.findOne({userId});
          const { favorites } = user;

          for (const article of articlesByTypeId) {
            const articleId = article._id;
            const isFav = favorites.includes(article._id);

            const articleHeading = `*Название статьи*: ${ article.name } `;
            const articleDescription = `*Описание статьи*: ${ article.description }`;
            //const articleLink = `[${ article.name }](${ article.link })`;

            const resMessage = `${ articleHeading } \n\n${ articleDescription } \n\n`;
            const picUrl = "https://devby.io/storage/images/50/85/44/91/derived/d43d698b57d948929798843e9095d6cd.jpg";

            //const tempUrl = __dirname + doc.picture;

            await bot.sendPhoto(chatId, picUrl, {
              caption: resMessage,
              parse_mode,
              reply_markup: {
                inline_keyboard: get_inline_keyboard({
                  link: article.link,
                  isFav,
                  articleId
                }),

                resize_keyboard: true
              }
            }).catch(e => {
              console.error(e);
            })
          }
        }
        else {
          await bot.sendMessage(chatId, "The articles collection is empty in this topic...");
        }
      }
      else {
        //handling regular keyboard messages
        handleRegularKeys(bot, msg, {
          ///keyboardArticles: "someArray"
          keyboardTopics: topicKeyboardCombined
        });
      }
    }
  }
  catch (e) {
    console.error(e);
  }
}

async function handleQuery(bot, query, params = {}) {
  try {
    const data = JSON.parse(query.data);
    const userId = query.from.id;
    const { type, articleId } = data;

    const user = await User.findOne({ userId });

    if (type === actionTypes.ARTICLE_FAVORITE_ADD) {
      if (!user.favorites.includes(articleId)) {
        user.favorites.push(articleId);
        await user.save();

        await bot.answerCallbackQuery(query.id, {
          text: `Статья сохранена в Избранных...`,
          show_alert: false
        })
      }
    }
    else if (data.type === actionTypes.ARTICLE_FAVORITE_REMOVE) {
      if (user.favorites.includes(articleId)) {
        user.favorites = user.favorites.filter(elem => elem !== articleId);

        await user.save();
        await bot.answerCallbackQuery(query.id, {
          text: `Статья убрана из Избранных...`,
          show_alert: false
        })
      }
    }
    else if (data.type === actionTypes.ARTICLE_EDIT) {

    }
    else if (data.type === actionTypes.ARTICLE_DELETE) {
      if (user.favorites.includes(articleId)) {
        user.favorites = user.favorites.filter(favId => favId !== articleId);

        await user.save();
        log("favorites are filtered...");
      }

      await Article.deleteOne({ _id: articleId });

      log(`article ${ articleId } is deleted`);

      await bot.answerCallbackQuery(query.id, {
        text: `Статья удалена...`,
        show_alert: false
      });

      //await bot.sendMessage( );
    }
  }
  catch (e) {
    console.error(e);
  }
}

function handleRegularKeys(bot, msg, params = {}) {
  const { text, chat } = msg;
  const userId = msg.from.id;
  const parse_mode = "Markdown";

  const keyboardMain = params?.keyboardMain || [];
  const keyboardTopics = params?.keyboardTopics || [];

  const regularKeysHandler = {
    [regularKeys.mainMenu.articles]: async () => {

      const keyboardTopicsCombined = [
        ...keyboardTopics,
        ...keyboard_initial.topicsMenu
      ];

      await bot.sendMessage(chat.id, "Выберите тему статей:", {
        reply_markup: {
          keyboard: keyboardTopicsCombined
        }
      });
    },
    [regularKeys.mainMenu.favorite]: async () => {

      const user = await User.findOne({ userId });
      const { favorites } = user;

      if (favorites.length) {
        for (const articleId of favorites) {
          const article = await Article.findOne({ _id: articleId });

          const articleHeading = `*Название статьи__*: ${ article.name } `;
          const articleDescription = `*Описание статьи*: ${ article.description }`;
          //const articleLink = `[${ article.name }](${ article.link })`;

          const resMessage = `${ articleHeading } \n\n${ articleDescription } \n\n`;
          const picUrl = "https://devby.io/storage/images/50/85/44/91/derived/d43d698b57d948929798843e9095d6cd.jpg";

          //const tempUrl = __dirname + doc.picture;

          await bot.sendPhoto(chat.id, picUrl, {
            caption: resMessage,
            parse_mode,
            reply_markup: {
              inline_keyboard: get_inline_keyboard({
                link: article.link,
                articleId,
                isFav: true,
              }),

              resize_keyboard: true
            }
          }).catch(e => {
            console.error(e);
          })
        }
      }
      else {
        await bot.sendMessage(chat.id, "Список Избранного пуст...");
      }


    },
    [regularKeys.topicsMenu.back]: async () => {
      const keyboardMainCombined = [
        ...keyboardMain,
        ...keyboard_initial.mainMenu
      ];


      await bot.sendMessage(chat.id, "На главное меню:", {
        reply_markup: {
          keyboard: keyboardMainCombined
        }
      });
    },
  };

  if (text in regularKeysHandler) {
    regularKeysHandler[text](params);
  }
}

function findTopicByProp(byProp, targetValue, topicsCollection = []) {
  return topicsCollection.find(topic => {
    if (topic[byProp]) {
      return topic[byProp] === targetValue
    }
    return false;
  });
}


///////////DEV
function log(it, comments = "value: ") {
  console.log(comments, it);
}