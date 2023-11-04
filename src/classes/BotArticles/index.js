const BotHandler = require("../BotHandler");
const DBHandler = require("../DBHandler");
const ArticleDraft = require("../ArticleDraft");
const _ = require("../../config");

const { splitArrBy, flattenObject, findObjFromArrByProp } = require("../../_utils");

const { specId } = process.env;
const { ARTICLES, ADD_ARTICLE } = _.getActionTypes();
const { mainMenu, topicsMenu, addArticleMenu } = _.getMenuTypes();

module.exports = class BotArticles {
  constructor() {
    this.botHandler = new BotHandler();
    this.dbHandler = new DBHandler();

    this.topicsCollection = [];
    this.topicsKeyboardMarkup = [];
    this.regularKeys = _.getRegularKeyboardKeys();

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

  /**
   * it returns the data for the inline-keyboard of the article message
   * @param userId
   * @param articleId
   * @returns {null|Object}
   * @private
   */
  _getInlineKeyboardData (userId, articleId) {
    if (userId in this.userCash) {
      const userArticlesDataMap = this.userCash[userId].articlesInlineKBParams; //returns Map
      if (userArticlesDataMap) {
        return userArticlesDataMap.get(articleId);
      }
      return null;
    } else {
      console.log(`the articleId ${articleId} is not found in the store...`);
      return null;
    }
  }

  _checkUserADraft (userId) {
    const aDraft = this.userCash[userId]?.aDraft || null;

    if (!aDraft) {
      throw new Error("article project is not created...");
    }
  }

  _checkADraftActiveProp (userId) {
    const { aDraft } = this.userCash[userId];
    if (!aDraft.activeProp) {
      throw new Error("activeProp is not set in the article project...");
    }
  }

  async handleRegularKey(chatId, userId, msgId, msgText) {
    const { mainMenu, topicsMenu } = _.getRegularKeyboardObj();
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
        this.userCash[userId].aDraft = new ArticleDraft();
        //const { aDraft } = this.userCash[userId];

        await this.botHandler._sendMessage(chatId, "Заполните поля для новой статьи:", {
          reply_markup: {
            inline_keyboard: _.get_inline_keyboard_articles_add(),
          }
        })
      },
      [mainMenu.favorite]: async () => {
        try {
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

              await this.botHandler.sendArticle(chatId, article,{
                reply_markup: {
                  inline_keyboard: _.get_inline_keyboard_articles({
                    ...params,
                  }),
                }
              })
            }
          }
          else {
            await this.botHandler._sendMessage(chatId, `Список *Избранного* пуст...`);
          }
        }
        catch (e) {
          console.error(e, "error at [mainMenu.favorite]: ");
        }
      },
      [topicsMenu.back]: async () => {
        await this.botHandler._sendMessage(chatId, "На главное меню:", {
          reply_markup: {
            keyboard: _.get_regular_keyboard_markup(isSpec, "mainMenu"),
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

      //log({msgText: msg.text, msgId, userId}, "received message: ");

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
            keyboard: _.get_regular_keyboard_markup(isSpec, "mainMenu"),
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

              await this.botHandler.sendArticle(chatId, article, {
                reply_markup: {
                  inline_keyboard: _.get_inline_keyboard_articles({
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
        else {
          //TODO: to test the support of the conditional chain
          //const activeProperty = this.userCash?[userId]?.aDraft?.activeProp || null;
          const activeProp = this.userCash[userId] && this.userCash[userId].aDraft
              && this.userCash[userId].aDraft.activeProp || null;

          if (activeProp) {
            log(activeProp, "activeProp: ");
            await this.botHandler.confirmAddArticleAction(chatId, msgId, userId, {
              activeProp,
              activePropValue: msg.text,
            });
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
      const aDraftPropValue = data?.apv || null;


      log(data, "data: ");

      const actionTypesArticlesHandles = {
        [ARTICLES.ARTICLE_FAVORITE_ADD]: async () => {
          try {
            if (isConfirmed) {
              //changing inline_keyboard to the cashed inline_keyboard...
              await this.useCashedInlineKB(articleId, chatId, msgId, userId, {
                isFav: true,
              });

              const user = await this.dbHandler.getDocumentByProp("User", {
                userId
              });

              //TODO: validation of articleId
              if (!user.favorites.includes(articleId)) {
                user.favorites.push(articleId);
                await user.save()
                    .then(() => this.botHandler._answerCallbackQuery(
                        query.id,
                        `Статья сохранена в Избранных...`
                    ));
              }
            }
            else {
              await this.botHandler.confirmArticleAction(chatId, msgId, userId, data);
            }
          }
          catch (e) {
            console.error("error at actionTypesArticlesHandles, ARTICLES.ARTICLE_FAVORITE_ADD: ", e);
          }
        },
        [ARTICLES.ARTICLE_FAVORITE_REMOVE]: async () => {
          try {
            if (isConfirmed) {
              await this.useCashedInlineKB(articleId, chatId, msgId, userId,{
                isFav: false,
              });

              const user = await this.dbHandler.getDocumentByProp("User", {
                userId
              });

              if (user.favorites.includes(articleId)) {
                user.favorites = user.favorites.filter(elem => elem !== articleId);

                await user.save()
                    .then(() => this.botHandler._answerCallbackQuery(
                        query.id,
                        `Статья убрана из Избранных...`
                    ));
              }
            }
            else {
              await this.botHandler.confirmArticleAction(chatId, msgId, userId, data);
            }
          }
          catch (e) {
            console.error("error at actionTypesArticlesHandles, ARTICLES.ARTICLE_FAVORITE_REMOVE: ", e);
          }
        },
        [ARTICLES.ARTICLE_DELETE]: async () => {
          try {
            if (isConfirmed) {
              log("ARTICLE_DELETE confirmed...");

            }
            else {
              await this.botHandler.confirmArticleAction(chatId, msgId, userId, data);
            }
          }
          catch (e) {
            console.error("error at actionTypesArticlesHandles, ARTICLES.ARTICLE_DELETE: ", e);
          }

        },
        [ARTICLES.ARTICLE_EDIT]: async () => {
          try {
            if (isConfirmed) {
              log("ARTICLE_EDIT confirmed...");
            }
            else {
              await this.botHandler.confirmArticleAction(chatId, msgId, userId, data);
            }
          }
          catch (e) {
            console.error("error at actionTypesArticlesHandles, ARTICLES.ARTICLE_EDIT: ", e);
          }

        },
        [ARTICLES.ARTICLE_CANCEL]: async () => {
          try {
            await this.useCashedInlineKB(articleId, chatId, msgId, userId);
          }
          catch (e) {
            console.error("error at actionTypesArticlesHandles, ARTICLES.ARTICLE_CANCEL: ", e);
          }
        }
      };

      const actionTypesArticleAddHandles = {
        [ADD_ARTICLE.ADD_ARTICLE_NAME]: async () => {
          try {
            this._checkUserADraft(userId);
            const { aDraft } = this.userCash[userId];
            aDraft.setActive("name");

            await this.botHandler._sendMessage(chatId, `Введите ${ addArticleMenu.name }`);
          }
          catch (e) {
            console.error("error at actionTypesArticleAddHandles, ADD_ARTICLE.ADD_ARTICLE_NAME: ", e);
          }
        },
        [ADD_ARTICLE.ADD_ARTICLE_NAME_GET]: async () => {
          try {
            this._checkUserADraft(userId);
            this._checkADraftActiveProp(userId);
            const { aDraft } = this.userCash[userId];

            if (!aDraftPropValue) {
              throw new Error("no property value given...");
            }

            aDraft.setActivePropValue(aDraftPropValue);

            await this.botHandler._answerCallbackQuery(
                //TODO: to use query.id of the aDraft menu
                query.id,
                `Сохранено название новой статьи: "${ aDraftPropValue }"`);

            log(aDraft.projectArticleData, "aDraft.projectArticleData: ");
          }
          catch (e) {
            console.error("error at actionTypesArticleAddHandles, ADD_ARTICLE.ADD_ARTICLE_NAME_GET: ", e);
          }
        },
        [ADD_ARTICLE.ADD_ARTICLE_NAME_CANCEL]: async () => {
          try {
            const { aDraft } = this.userCash[userId];
            aDraft.activeProp = null;
          }
          catch (e) {
            console.error("error at actionTypesArticleAddHandles, ADD_ARTICLE.ADD_ARTICLE_NAME_CANCEL: ", e);
          }
        },
        [ADD_ARTICLE.ADD_ARTICLE_DESCRIPTION]: async () => {
          try {
            await this.botHandler._sendMessage(chatId, `Введите ${ addArticleMenu.description }`);
          }
          catch (e) {
            console.error("error at actionTypesArticleAddHandles, ADD_ARTICLE.ADD_ARTICLE_DESCRIPTION: ", e);
          }

        },
        [ADD_ARTICLE.ADD_ARTICLE_LINK]: async () => {
          try {
            await this.botHandler._sendMessage(chatId, `Введите ${ addArticleMenu.link }`);
          }
          catch (e) {
            console.error("error at actionTypesArticleAddHandles, ADD_ARTICLE.ADD_ARTICLE_LINK: ", e);
          }
        },
        [ADD_ARTICLE.ADD_ARTICLE_TYPEID]: async () => {
          try {
            const topicsDataArr = this.topicsCollection.map(topic => ({
              name: topic.name,
              typeId: topic.typeId
            }));

            await this.botHandler.editMessageText("Выберите тематику для новой статьи: ", {
              chat_id: chatId,
              message_id: msgId,
              reply_markup: {
                inline_keyboard: _.get_inline_keyboard_topics(topicsDataArr),
              }
            })
          }
          catch (e) {
            console.error("error at actionTypesArticleAddHandles, ADD_ARTICLE.ADD_ARTICLE_TYPEID: ", e);
          }
        },
        [ADD_ARTICLE.ADD_ARTICLE_TYPEID_GET]: async () => {
          try {
            this._checkUserADraft(userId);
            const targetObj = findObjFromArrByProp(this.topicsCollection, { typeId: topicTypeId });
            const { aDraft } = this.userCash[userId];

            aDraft.setProp({ typeId: topicTypeId });

            await Promise.all([
              this.botHandler._answerCallbackQuery(
                  query.id,
                  `Сохранено в тематике: "${ targetObj.name }"`),
              this.botHandler.checkAndSendMessageWithEmptyADraftProps(chatId, msgId, query.id, aDraft),
            ]);
          }
          catch (e) {
            console.error("error at actionTypesArticleAddHandles, ADD_ARTICLE.ADD_ARTICLE_TYPEID_GET: ", e);
          }
        },
        [ADD_ARTICLE.ADD_ARTICLE_TYPEID_CANCEL]: async () => {
          this._checkUserADraft(userId);
          const { aDraft } = this.userCash[userId];
          await this.botHandler.checkAndSendMessageWithEmptyADraftProps(chatId, msgId, query.id, aDraft);
        },
        [ADD_ARTICLE.ADD_ARTICLE_SUBMIT]: async () => {
          log("submit...");
          //TODO: to check all props to be filled;
        },
        [ADD_ARTICLE.ADD_ARTICLE_CANCEL]: async () => {
          await this.botHandler.deleteMessage(chatId, msgId);
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

  async useCashedInlineKB (articleId, chatId, msgId, userId, params={}) {
    //getting the cashed data for creating the inline_keyboard of a particular message with the Article
    const auxData = this._getInlineKeyboardData(userId, articleId);

    await this.botHandler.editMessageReplyMarkup({
      inline_keyboard: _.get_inline_keyboard_articles({
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

      const regularKeyboardMarkup = _.get_regular_keyboard_markup(); //returns Obj.mainMenu, Obj.topicsMenu

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