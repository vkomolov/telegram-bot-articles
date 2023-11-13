const BotHandler = require("../BotHandler");
const DBHandler = require("../DBHandler");
const UserCash = require("../UserCash");
const _ = require("../../config");

const { splitArrBy, flattenObject, findObjFromArrByProp } = require("../../_utils");

const { specId } = process.env;
const { ARTICLES, ADD_ARTICLE } = _.getActionTypes();
const { mainMenu, topicsMenu, addArticleMenu } = _.getMenuKeys();

module.exports = class BotArticles {
  constructor() {
    //it initiates new TelegramBot with the handling methods
    this.botHandler = new BotHandler();

    //it initiates the database connection with the handling methods
    this.dbHandler = new DBHandler();

    this.topicsCollection = [];
    this.topicsKeyboardMarkup = [];
    this.regularKeys = _.getRegularKeyboardKeys();

    //making cash for each user...
    this.usersCash = new Map();

    this.handleMessage = this.handleMessage.bind(this);
    this.handleQuery = this.handleQuery.bind(this);
  }
///END OF CONSTRUCTOR

  _getUserIdCash (userId) {
    const userIdCash = this.usersCash.get(userId);

    if (!userIdCash) {
      throw new Error(`no user cash with user id: ${ userId } found...`);
    }

    return userIdCash;
  }

  _getAndCashArticleInlineKBParams (article, userId, isFav, isSpec) {
    const articleId = article._id.toString();  //converting from ObjectId()
    //it returns UserCash instance
    const userIdCash = this._getUserIdCash(userId);

    const params = {
      link: article.link,
      articleId,
      isFav,
      isSpec
    };

    userIdCash.cashArticleData(articleId, params);

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
    const userIdCash = this._getUserIdCash(userId);

    return userIdCash.getInlineKBMap(articleId); //returns Map
  }

  _getUserADraft (userId) {
    const userIdCash = this._getUserIdCash(userId);
    return userIdCash.getArticleDraft();
  }

  //{ chatId, msgId }
  _cashMsg (userId, msgData) {
    const userIdCash = this._getUserIdCash(userId);
    userIdCash.cashMsg(msgData);

    log(msgData, "msgData at _cashMsg:");

    log(userIdCash.getMsgCash(), "userCash cashed...");
  }

  _cashKbMsg (userId, msgData) {
    const userIdCash = this._getUserIdCash(userId);
    userIdCash.cashKBMsg(msgData);

    log(userIdCash.getKBMsgCash(), "keyboard cashed...")
  }

  _cashInKbMsg (userId, msgData) {
    const userIdCash = this._getUserIdCash(userId);
    userIdCash.cashInKBMsg(msgData);

    log(userIdCash.getKBMsgCash(), "keyboard cashed...")
  }

  _getMsgResultData (sentMsgResult) {
    if (sentMsgResult?.chat?.id && sentMsgResult?.message_id) {
      return {
        chatId: sentMsgResult.chat.id,
        msgId: sentMsgResult.message_id,
      };
    }
    else {
      throw new Error(`no necessary properties found: chat.id, message_id...`);
    }
  }

  async _userMsgCashClean (userId) {
    const userIdCash = this._getUserIdCash(userId);

    const msgCashArr = userIdCash.getMsgCash();
    for (const { chatId, msgId } of msgCashArr) {
      await this.botHandler.deleteMessage(chatId, msgId);
    }

    log(userIdCash.getMsgCash(), "cash before clean: ");

    userIdCash.msgCashClean();

    log(userIdCash.getMsgCash(), "cash after clean: ");
  }

  async handleRegularKey(_chatId, userId, _msgId, msgText) {
    const { mainMenu, topicsMenu } = _.getRegularKeyboardObj();
    const isSpec = userId.toString() === specId.toString();

    const actionsObj = {
      [mainMenu.articles]: async () => {
        //await this._userMsgCashClean(userId);
        const userIdCash = this._getUserIdCash(userId);
        userIdCash.cashMsg({chatId: _chatId, msgId: _msgId});

        const { chatId, msgId } = userIdCash.getKBMsgCash();

        log(userIdCash.getMsgCash(), "userIdCash.getMsgCash(): ");
        log(userIdCash.getKBMsgCash(), "userIdCash.getKBMsgCash(): ");

        await this.botHandler.editMessageText("Выберите тему статей:", {
          chat_id: chatId,
          message_id: msgId,
          reply_markup: {
            keyboard: this.topicsKeyboardMarkup,
            resize_keyboard: true
          }
        })

/*        await this.botHandler._sendMessage(chatId, "Выберите тему статей:", {
          reply_markup: {
            keyboard: this.topicsKeyboardMarkup,
            resize_keyboard: true
          }
        })
            .then(msgResult => this._cashKbMsg(userId, this._getMsgResultData(msgResult)));*/
      },
      [mainMenu.articleAdd]: async () => {
        const userIdCash = this._getUserIdCash(userId);

        /**
         * Making the object for the temporal new article to be filled with the required properties
         * Every action for creation article will clean previous params with new object
         */
        userIdCash.createArticleDraft();

        await this._userMsgCashClean(userId);

        await this.botHandler._sendMessage(chatId, "Заполните поля для новой статьи:", {
          reply_markup: {
            inline_keyboard: _.get_inline_keyboard_articles_add(),
          }
        })
            .then(msgResult => this._cashInKbMsg(userId, this._getMsgResultData(msgResult)));
      },
      [mainMenu.favorite]: async () => {
        try {
          const user = await this.dbHandler.getDocumentByProp(
              "User",
              {
                userId
              });

          const { favorites } = user;

          await this._userMsgCashClean();

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
                  .then(msgResult => this._cashMsg(userId, this._getMsgResultData(msgResult)));
            }
          }
          else {
            await this.botHandler._sendMessage(chatId, `Список *Избранного* пуст...`)
                .then(msgResult => this._cashMsg(userId, this._getMsgResultData(msgResult)));
          }
        }
        catch (e) {
          console.error(e, "error at [mainMenu.favorite]: ");
        }
      },
      [topicsMenu.back]: async () => {
/*        await this.botHandler._sendMessage(chatId, "На главное меню:", {
          reply_markup: {
            keyboard: _.get_regular_keyboard_markup(isSpec, "mainMenu"),
            resize_keyboard: true
          }
        });*/
            //.then(msgResult => this._cashSentMsgResult(userId, msgResult));
        const userIdCash = this._getUserIdCash(userId);
        const { chatId, msgId } = userIdCash.getKBMsgCash();

        await this.botHandler.editMessageText("На главное меню:", {
          chat_id: chatId,
          message_id: msgId,
          reply_markup: {
            keyboard: _.get_regular_keyboard_markup(isSpec, "mainMenu"),
            resize_keyboard: true
          }
        });
      }
    };

    if (msgText in actionsObj) {
      await actionsObj[msgText]();
    }
  }

  async handleMessage(msg) {
    try {
      const msgId = msg.message_id;
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const isSpec = userId.toString() === specId.toString();

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

        const userIdCash = new UserCash(userId);
        //creating new cash fot userId

        //cashing data for userId
        this.usersCash.set(userId, userIdCash);

        //cashing message
        this._cashMsg(userId, { chatId, msgId });

        //cleaning previous cashed messages... (now it is only one record with "/start" cased message)...
        await Promise.all([
          this._userMsgCashClean(userId),
          this.botHandler.welcomeUser({ chatId, user, userLastVisit }, {
            reply_markup: {
              keyboard: _.get_regular_keyboard_markup(isSpec, "mainMenu"),
              resize_keyboard: true
            }
          })
              .then(msgRes => {
                this._cashKbMsg(userId, this._getMsgResultData(msgRes));
              })
        ]);
      }
      else if (this.regularKeys.includes(msg.text)) {
        //const userIdCash = this.usersCash.get(userId);
        //this._cashMsg(userId, { chatId, msgId });

        await this._userMsgCashClean(userId);

        //userIdCash && userIdCash.cashMsg(chatId, msgId);

        await this.handleRegularKey(chatId, userId, msgId, msg.text);

/*        await Promise.all([
          this.handleRegularKey(chatId, userId, msgId, msg.text),
          this._userMsgCashClean(userId),
        ])*/
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

          await this._userMsgCashClean(userId);

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
                  .then(msgRes => this._cashMsg(userId, this._getMsgResultData(msgRes)));
            }
          }
          else {
            await this.botHandler._sendMessage(chatId, "В коллекции пусто...")
                .then(msgRes => this._cashMsg(userId, this._getMsgResultData(msgRes)));
          }
        }
        else {
          const userIdCash = this.usersCash.get(userId);

          if (userIdCash) {
            const aDraft = userIdCash.getArticleDraft();

            /**
             * if article draft property is active in aDraft.activeProp, then to confirm the article draft property
             * to equal the received msg.text
             */
            if (aDraft && aDraft.activeProp) {
              const { activeProp } = aDraft;

              log(activeProp, "activeProp at handlingMessage: ");

              await this.botHandler.confirmAddArticleAction(chatId, msgId, userId, {
                activeProp,
                activePropValue: msg.text,
              })
                  .then(msgRes => this._cashMsg(userId, this._getMsgResultData(msgRes)));
            }
            else {
              log(msg.text, "msg.text on the out...");

              this._cashMsg(userId, { chatId, msgId });

              log(userIdCash.getMsgCash(), "userIdCash.getMsgCash(): ");

              //userIdCash.cashMsg(chatId, msgId);
              await this.botHandler._sendMessage(chatId, `Я не понял... 
              \nСделай выбор из меню...\nНажми на квадратный значок клавиатуры справа...`)
                  .then(msgRes => {
                    this._cashMsg(userId, this._getMsgResultData(msgRes));

                    setTimeout(() => {
                      this._userMsgCashClean(userId);
                    }, 2000);
                  });

              //userIdCash.cashMsg(chatId, msgId);
              //ToDO: to realise msgCash
            }
          }
          else {
            await this.botHandler._sendMessage(chatId, "Нажмите на кнопку *Меню* и выберите *Cтарт*...")
                .then(msgRes => {
                  setTimeout(() => {
                    this.botHandler.deleteMessage(...Object.values(this._getMsgResultData(msgRes)));
                    this.botHandler.deleteMessage(chatId, msgId);
                  }, 1000);
                });

            log("message received without userIdCash...");
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
      const propVal = data?.val || null;

      log(data, "data: ");

      const actionTypesArticlesHandles = {
        [ARTICLES.ARTICLE_FAVORITE_ADD]: async () => {
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
        [ADD_ARTICLE.ADD_ARTICLE_PROP]: async () => {
          const aDraft = this._getUserADraft(userId);

          if (!propVal) {
            throw new Error(`Error at ADD_ARTICLE.ADD_ARTICLE_PROP with invalid proVal: ${ propVal }`);
          }

          //log(propVal, "propVal: ");

          //catching with .set activeProp(propName)
          aDraft.activeProp = propVal;

          if (propVal.toString() === "typeId") {
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
          } else {
            await this.botHandler._sendMessage(chatId, `Введите ${ addArticleMenu[propVal] }`);
          }
          //log(aDraft, "aDraft: ");

        },
        [ADD_ARTICLE.ADD_ARTICLE_PROP_SET]: async () => {
          const aDraft = this._getUserADraft(userId);
          const { activeProp } = aDraft;

          if (!propVal) {
            throw new Error(`Error at ADD_ARTICLE.ADD_ARTICLE_PROP_SET with invalid proVal: ${ propVal }`);
          }
          if (!activeProp) {
            throw new Error(`Error at ADD_ARTICLE.ADD_ARTICLE_PROP_SET with invalid activeProp: ${ activeProp }`);
          }

          //aDraft.activeProp = propVal;
          aDraft.setActivePropValue(propVal);

          if (activeProp === "typeId") {
            const targetObj = findObjFromArrByProp(this.topicsCollection, { typeId: propVal });

            log(targetObj, "targetObj:");

            await Promise.all([
              this.botHandler._answerCallbackQuery(
                  query.id,
                  `Сохранено в тематике: "${ targetObj.name }"`),
              this.botHandler.checkAndSendMessageWithEmptyADraftProps(chatId, msgId, query.id, aDraft),
            ]);
          } else {
            await this.botHandler._answerCallbackQuery(
                //TODO: to use query.id of the aDraft menu
                query.id,
                `В поле "${ aDraft.activeProp }" сохранено значение: "${ propVal }"`,
            );
          }

          log(aDraft.projectArticleData, "aDraft.projectArticleData: ");
        },
        [ADD_ARTICLE.ADD_ARTICLE_PROP_CANCEL]: async () => {
          const aDraft = this._getUserADraft(userId);
          aDraft.activeProp = null;
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
      //initiating the bot and the database connection
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

      //returns Obj.mainMenu, Obj.topicsMenu
      const regularKeyboardMarkup = _.get_regular_keyboard_markup();

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