const BotHandler = require("../BotHandler");
const DBHandler = require("../DBHandler");

const {
  get_regular_keyboard_markup, getRegularKeyboardKeys, getMenuTypes, get_inline_keyboard_topics,
  getRegularKeyboardObj, get_inline_keyboard_articles, get_inline_keyboard_articles_add, getActionTypes
} = require("../../config");
//const { handleMessages, handleQuery } = require("../../_handlers");
const { splitArrBy, flattenObject } = require("../../_utils");

const { specId } = process.env;
const { ARTICLES, ADD_ARTICLE } = getActionTypes();
const { mainMenu, topicsMenu, addArticleMenu } = getMenuTypes();

module.exports = class BotArticles {
  constructor() {
    this.botHandler = new BotHandler();
    this.dbHandler = new DBHandler();

    this.topicsCollection = [];
    this.topicsKeyboardMarkup = [];
    this.regularKeys = getRegularKeyboardKeys();

    //data for creating inline-keyboards for each article, temporal new articles...
    this.userCash = {};

    this.handleMessage = this.handleMessage.bind(this);
    this.handleQuery = this.handleQuery.bind(this);
  }
///END OF CONSTRUCTOR

  _getAndCashArticleInlineKBParams (article, userId, isFav, isSpec) {
    const articleId = article._id.toString();  //converting from ObjectId()

    const params = {
      link: article.link,
      articleId,
      isFav,
      isSpec
    };

    if (!this.userCash[userId]) {
      this.userCash[userId] = {};
    }

    if (!this.userCash[userId].articlesInlineKBParams) {
      this.userCash[userId].articlesInlineKBParams = new Map();
    }

    this.userCash[userId].articlesInlineKBParams.set(articleId, params);

    return params;
  }

  _getInlineKeyboardData (userId, articleId) {
    if (userId in this.userCash) {
      const userArticles = this.userCash[userId].articlesInlineKBParams; //returns Map
      return userArticles.get(articleId);
    } else {
      console.error(`the articleId ${articleId} is not found in the store...`);
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
            resize_keyboard: true
          }
        })
      },
      [mainMenu.articleAdd]: async () => {
        if (!this.userCash[userId]) {
          this.userCash[userId] = {};
        }

        /**
         * Making the object for the temporal new article to be filled with the required properties
         * Every action for creation article will clean previous params with new object
         */
        this.userCash[userId].newArticle = {
          name: null,
          typeId: null,
          description: null,
          link: null
        };

        await this.botHandler._sendMessage(chatId, "Заполните поля ресурса:", {
          reply_markup: {
            inline_keyboard: get_inline_keyboard_articles_add()
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

            //isFav is true
            const params = this._getAndCashArticleInlineKBParams(article, userId, true, isSpec);

            await this.botHandler._sendArticle(chatId, article,{
              reply_markup: {
                inline_keyboard: get_inline_keyboard_articles({
                  ...params,
                }),
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
            keyboard: get_regular_keyboard_markup(isSpec, "mainMenu"),
            resize_keyboard: true
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
      const msgId = msg.message_id;
      const chatId = msg.chat.id.toString();
      const userId = msg.from.id.toString();
      const isSpec = userId === specId.toString();

      const { first_name, last_name, is_bot, language_code } = msg.from;

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
            keyboard: get_regular_keyboard_markup(isSpec, "mainMenu"),
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
              const params = this._getAndCashArticleInlineKBParams(article, userId, isFav, isSpec);

              log(params, "params: ");

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
      const userId = query.from.id.toString();
      const chatId = query.message.chat.id.toString();
      const msgId = query.message.message_id.toString();

      const data = JSON.parse(query.data);
      const actionType = data?.tp || null;
      const articleId = data?.aId || null;
      const isConfirmed = data?.ok || null; //true|false is confirmed... null - empty;
      const topicTypeId = data?.tt || null;

      log(data, "data: ");

      const actionTypesArticlesHandles = {
        [ARTICLES.ARTICLE_FAVORITE_ADD]: async () => {
          if (isConfirmed) {
            //deleting cashed inline_keyboard data...
            await this.setCashedArticleInlineKB(articleId, chatId, msgId, userId, {
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
            await this.botHandler.confirmArticleAction(chatId, msgId, userId, data);
          }
        },
        [ARTICLES.ARTICLE_FAVORITE_REMOVE]: async () => {
          if (isConfirmed) {
            await this.setCashedArticleInlineKB(articleId, chatId, msgId, userId,{
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
            await this.botHandler.confirmArticleAction(chatId, msgId, userId, data);
          }

        },
        [ARTICLES.ARTICLE_DELETE]: async () => {
          if (isConfirmed) {
            log("ARTICLE_DELETE confirmed...");

          }
          else {
            await this.botHandler.confirmArticleAction(chatId, msgId, userId, data);
          }
        },
        [ARTICLES.ARTICLE_EDIT]: async () => {
          if (isConfirmed) {
            log("ARTICLE_EDIT confirmed...");
          }
          else {
            await this.botHandler.confirmArticleAction(chatId, msgId, userId, data);
          }
        },
        [ARTICLES.ARTICLE_CANCEL]: async () => {
          await this.setCashedArticleInlineKB(articleId, chatId, msgId, userId);
        }
      };

      const actionTypesArticleAddHandles = {
        [ADD_ARTICLE.ADD_ARTICLE_NAME]: async () => {
          await this.botHandler._sendMessage(chatId, `Введите ${ addArticleMenu.addArticleName }`);
        },
        [ADD_ARTICLE.ADD_ARTICLE_DESCRIPTION]: async () => {
          await this.botHandler._sendMessage(chatId, `Введите ${ addArticleMenu.addArticleDescription }`);
        },
        [ADD_ARTICLE.ADD_ARTICLE_LINK]: async () => {
          await this.botHandler._sendMessage(chatId, `Введите ${ addArticleMenu.addArticleLink }`);
        },
        [ADD_ARTICLE.ADD_ARTICLE_TYPEID]: async () => {
          //log(this.topicsCollection, "this.topicsCollection: ");
          //_id, name, typeId
          const topicsDataArr = this.topicsCollection.map(topic => ({
            name: topic.name,
            typeId: topic.typeId
          }));

          const inline_keyboard = get_inline_keyboard_topics(topicsDataArr);


          await this.botHandler._sendMessage(
              chatId,
              `Выберите ${ addArticleMenu.addArticleTypeId }`,
              {
                reply_markup: {
                  inline_keyboard
                }
              }
              );


        },
        [ADD_ARTICLE.ADD_ARTICLE_SUBMIT]: async () => {
          log("submit...");
          //TODO: to check all props to be filled;
        },
        [ADD_ARTICLE.ADD_ARTICLE_CANCEL]: async () => {
          log("cancelling...");
          //TODO: to return remove the message with inline_keyboard for adding article
        },
      };

      /**
       * if data.type of callback_query is in ARTICLES,
       * then to handle callback_query from article inline_keyboard
       */
      if (actionType) {
        if (actionType in actionTypesArticlesHandles) {
          actionTypesArticlesHandles[actionType]();
        }
        else if (actionType in actionTypesArticleAddHandles) {
          actionTypesArticleAddHandles[actionType]();
        }
      }
    }
    catch (e) {
      console.error("error at handleQuery", e);
    }
  }

  async setCashedArticleInlineKB (articleId, chatId, msgId, userId, params={}) {
    const auxData = this._getInlineKeyboardData(userId, articleId);

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