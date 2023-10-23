const BotHandler = require("../BotHandler");
const DBHandler = require("../DBHandler");

const {
  get_regular_keyboard_markup, getRegularKeyboardKeys,
  getRegularKeyboardObj, get_inline_keyboard_articles, getActionTypes
} = require("../../config");
//const { handleMessages, handleQuery } = require("../../_handlers");
const { splitArrBy, flattenObject } = require("../../_utils");

const { specId } = process.env;
const actionTypesArticles = getActionTypes().ARTICLES;
const actionTypesActions = getActionTypes().ACTIONS;

module.exports = class BotArticles {
  constructor() {
    this.botHandler = new BotHandler();
    this.dbHandler = new DBHandler();

    this.topicsCollection = [];
    this.mainKeyboardMarkup = [];
    this.topicsKeyboardMarkup = [];
    this.regularKeys = getRegularKeyboardKeys();
    //data for creating inline-keyboards for each article
    this.inlineKeyboardStore = {};

    this.handleMessage = this.handleMessage.bind(this);
    this.handleQuery = this.handleQuery.bind(this);
  }
///END OF CONSTRUCTOR

  _getInlineKeyboardData (articleId) {
    if (articleId in this.inlineKeyboardStore) {
      return this.inlineKeyboardStore[articleId];
    } else {
      console.error(`the articleId ${articleId} is not found...`);
      return null;
    }
  }

  async handleRegularKey(chatId, userId, msgId, msgText) {
    const { mainMenu, topicsMenu } = getRegularKeyboardObj();
    const isSpec = userId.toString() === specId.toString();

    const actionsObj = {
      [mainMenu.articles]: async () => {
        await this.botHandler._sendMessage(chatId, "Выберите тему статей:", {
          reply_markup: {
            keyboard: this.topicsKeyboardMarkup,
          }
        })
      },
      [mainMenu.favorite]: async () => {
        const user = await this.dbHandler.getDocumentByProp(
            "User",
            {
              userId
            });

        const { favorites } = user;
        if (favorites.length) {
          for (const articleId of favorites) {
            const article = await this.dbHandler.getDocumentByProp("Article", {
              _id: articleId
            });

            await this.botHandler._sendArticle(chatId, article,{
              reply_markup: {
                inline_keyboard: get_inline_keyboard_articles({
                  link: article.link,
                  articleId: article._id,
                  isFav: true,
                  isSpec
                })
              }
            })

          }
        }
        else {
          await this.botHandler._sendMessage(chatId, `Список *Избранного* пуст...`);
        }

      },
      [topicsMenu.back]: async () => {
        await this.botHandler._sendMessage(chatId, "На главное меню:", {
          reply_markup: {
            keyboard: this.mainKeyboardMarkup,
          }
        })
      }
    };
    if (msgText in actionsObj) {
      await actionsObj[msgText]();
    }
  }

  async handleMessage(msg) {
    try {
      const msgId = msg.message_id; //for deleting previous messages
      const chatId = msg.chat.id.toString();
      const userId = msg.from.id.toString();
      const isSpec = userId === specId.toString();

      const { first_name, last_name, is_bot, language_code } = msg.from;
      const userName = `${ first_name } ${ last_name }`;

      ////CONDITIONS
      if (msg.text.startsWith("/start")) {
        //creating incoming user
        const incomingUser = {
          userId,
          first_name,
          last_name,
          language_code,
          last_visit: Date.now(),
          favorites: []
        };

        //checking user... if user exists in the database, then to update last_visit
        const { user, userLastVisit } = await this.dbHandler.checkUserAndSave(incomingUser);
        //new users have userLastVisit value to be null
        if (!userLastVisit) {
          console.log(`new user ${ user.userId } saved...`);
        }
        else {
          console.log(`the user ${ user.userId } is updated with the last visit date...`);
          //log(user, "user updated: ");
        }

        await this.botHandler.welcomeUser({ chatId, user, userLastVisit }, {
          reply_markup: {
            keyboard: this.mainKeyboardMarkup,
            resize_keyboard: true
          }
        });
      }
      else if (this.regularKeys.includes(msg.text)) {
        await this.handleRegularKey(chatId, userId, msgId, msg.text);
      }
      else {
        const topicsKeys = this.topicsCollection.map(({ name }) => name);
        const foundIndex = topicsKeys.indexOf(msg.text);

        if (foundIndex !== -1) {
          const { typeId } = this.topicsCollection[foundIndex];
          const collectionArticles = await this.dbHandler.getCollectionByModel(
              "Article",
              {
                typeId
              },
              {
                sortBy: {
                  typeId: 1
                }
              });

          const userFavorites = await this.dbHandler.getDocumentByProp("User", {
            userId
          })
              .then(doc => doc.favorites);

          if (collectionArticles.length) {
            for (const article of collectionArticles) {
              const isFav = userFavorites.includes(article._id);

              const params = {
                link: article.link,
                articleId: article._id,
                isFav,
                isSpec
              };

              this.inlineKeyboardStore[article._id] = {
                ...params,
              };

              await this.botHandler._sendArticle(chatId, article, {
                reply_markup: {
                  inline_keyboard: get_inline_keyboard_articles({
                    ...params,
                  }),
                }
              })
            }
          }
          else {
            await this.botHandler._sendMessage(chatId, "В коллекции пусто...");
          }
        }
      }
    }
    catch (e) {
      console.error("error at handleMessage", e);
    }
  }

  async handleQuery(query) {
    try {
      const userId = query.from.id;
      const chatId = query.message.chat.id.toString();
      const msgId = query.message.message_id;
      const data = JSON.parse(query.data);
      const actionType = data?.tp || null;
      const articleId = data?.aId || null;
      const isConfirmed = data?.ok || null; //true|false is confirmed... null - empty;

      log(data, "data: ");

      const actionTypesHandles = {
        [actionTypesArticles.ARTICLE_FAVORITE_ADD]: async (articleId, isConfirmed) => {
          if (isConfirmed) {
            await this.setDefaultInlineKeyboard(articleId, chatId, msgId, {
              isFav: true,
            });

            const user = await this.dbHandler.getDocumentByProp("User", {
              userId
            });

            //TODO: validation of articleId
            if (!user.favorites.includes(articleId)) {
              user.favorites.push(articleId);
              await user.save();
              await this.botHandler.bot.answerCallbackQuery(query.id, {
                text: `Статья сохранена в Избранных...`,
                show_alert: false
              })
            }
          }
          else {
            await this.botHandler.getConfirmation(chatId, msgId, data);
          }
        },
        [actionTypesArticles.ARTICLE_FAVORITE_REMOVE]: async (articleId, isConfirmed) => {
          if (isConfirmed) {
            await this.setDefaultInlineKeyboard(articleId, chatId, msgId, {
              isFav: false,
            });

            const user = await this.dbHandler.getDocumentByProp("User", {
              userId
            });

            if (user.favorites.includes(articleId)) {
              user.favorites = user.favorites.filter(elem => elem !== articleId);

              await user.save();
              await this.botHandler.bot.answerCallbackQuery(query.id, {
                text: `Статья убрана из Избранных...`,
                show_alert: false
              })
            }
          }
          else {
            await this.botHandler.getConfirmation(chatId, msgId, data);
          }

        },
        [actionTypesArticles.ARTICLE_ADD]: async () => {
          log("ARTICLE_ADD...");

        },
        [actionTypesArticles.ARTICLE_DELETE]: async (articleId, isConfirmed) => {
          if (isConfirmed) {
            log("ARTICLE_DELETE confirmed...");

          }
          else {
            await this.botHandler.getConfirmation(chatId, msgId, data);
          }
        },
        [actionTypesArticles.ARTICLE_EDIT]: async (articleId, isConfirmed) => {
          if (isConfirmed) {
            log("ARTICLE_EDIT confirmed...");
          }
          else {
            await this.botHandler.getConfirmation(chatId, msgId, data);
          }
        },
        [actionTypesActions.ACTION_CANCEL]: async (articleId) => {
          await this.setDefaultInlineKeyboard(articleId, chatId, msgId);
        }
      };

      /**
       * if data.type of callback_query is in actionTypesArticles,
       * then to handle callback_query from article inline_keyboard
       */
      if (actionType && actionType in actionTypesHandles) {
        actionTypesHandles[actionType](articleId, isConfirmed);
      }
    }
    catch (e) {
      console.error("error at handleQuery", e);
    }
  }

  async setDefaultInlineKeyboard (articleId, chatId, msgId, params={}) {
    const auxData = this._getInlineKeyboardData(articleId);

    //log(auxData, "auxData: ");

    await this.botHandler._editMessageReplyMarkup({
      inline_keyboard: get_inline_keyboard_articles({
        ...auxData,
        ...params,
      })
    }, {
      chat_id: chatId,
      message_id: msgId
    });
  }

  async start() {
    try {
      await Promise.all([
        this.dbHandler.connectDb({
          useNewUrlParser: true,
          useUnifiedTopology: true
        }),
        this.botHandler.initBot({
          handleMessage: this.handleMessage,
          handleQuery: this.handleQuery
        }),
      ]);

      const regularKeyboardMarkup = get_regular_keyboard_markup(); //returns Obj.mainMenu, Obj.topicsMenu

      this.topicsCollection = await this.dbHandler.getCollectionByModel("Topic", {}, {
        showBy: {
          name: 1,
          typeId: 1
        },
        sortBy: {
          typeId: 1
        }
      });

      const topicsKeys = this.topicsCollection.map(({ name }) => name);
      const topicsKeyboardMarkupUpdate = splitArrBy(topicsKeys, 2);

      this.mainKeyboardMarkup = this.mainKeyboardMarkup.concat([
        ...regularKeyboardMarkup.mainMenu
      ]);
      this.topicsKeyboardMarkup = this.topicsKeyboardMarkup.concat([
        ...topicsKeyboardMarkupUpdate,
        ...regularKeyboardMarkup.topicsMenu
      ]);

    }
    catch (e) {
      console.error(e)
    }
  }
};


///////////DEV
function log(it, comments = "value: ") {
  console.log(comments, it);
}