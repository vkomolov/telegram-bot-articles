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

  _cashMsg (userId, msgData) {
    const userIdCash = this._getUserIdCash(userId);
    userIdCash.cashMsg(msgData);
  }

  _cashInKbMsg (userId, msgData) {
    const userIdCash = this._getUserIdCash(userId);
    userIdCash.cashInKBMsg(msgData);
  }

  _getMsgResultData (sentMsgResult) {
    if (sentMsgResult?.chat?.id && sentMsgResult?.message_id) {
      return {
        chat_id: sentMsgResult.chat.id,
        message_id: sentMsgResult.message_id,
      };
    }
    else {
      throw new Error(`no necessary properties found: chat.id, message_id...`);
    }
  }

  _activePropReset (userId) {
    const userIdCash = this.usersCash.get(userId);
    if (userIdCash) {
      const aDraft = userIdCash.getArticleDraft();
      if (aDraft && aDraft.activeProp) {
        aDraft.activeProp = null;
      }
    }
  }

  async _returnToMainKeyboard (chat_id, userId) {
    const isSpec = userId === specId.toString();

    await this.botHandler._sendMessage(chat_id, `Главное меню:`, {
      reply_markup: {
        keyboard: _.get_regular_keyboard_markup(isSpec, "mainMenu"),
        resize_keyboard: true
      }
    })
        .then(async msgRes => {
          await this._updateKbMsgCash(userId, this._getMsgResultData(msgRes));
          setTimeout(() => {
            this._userMsgCashClean(userId);
          }, 500);
        });
  }

  async _updateKbMsgCash (userId, msgData) {
    const userIdCash = this._getUserIdCash(userId);
    const kbMsgCash = {
      ...userIdCash.getKBMsgCash()
    };

    userIdCash.cashKBMsg({...msgData});

    if (kbMsgCash && kbMsgCash.chat_id && kbMsgCash.message_id) {
      //cashing for future delete
      userIdCash.cashMsg({
        chat_id: kbMsgCash.chat_id,
        message_id: kbMsgCash.message_id
      });
      //await this.botHandler.deleteMessage(kbMsgCash.chat_id, kbMsgCash.message_id);
    }
  }

  async _userInKBMsgCashClean (userId) {
    const userIdCash = this.usersCash.get(userId);
    if (userIdCash) {
      //const { chat_id, message_id } = userIdCash.getInKBMsgCash();
      const inKBMsgCash = userIdCash.getInKBMsgCash();

      if (inKBMsgCash && inKBMsgCash.chat_id && inKBMsgCash.message_id) {
        //cashing without arguments for cleaning inKBMsgCash to {}
        userIdCash.cashInKBMsg();

        this._cashMsg(userId, {
          chat_id: inKBMsgCash.chat_id,
          message_id: inKBMsgCash.message_id,
        })
      }
    }
  }

  async _userMsgCashClean (userId) {
    const userIdCash = this.usersCash.get(userId);
    if (userIdCash) {
      const msgCashArr = userIdCash.getMsgCash();

      for (const { chat_id, message_id } of msgCashArr) {
        try {
          if (chat_id && message_id) {
            await this.botHandler.deleteMessage(chat_id, message_id);
          }
          else {
            console.error(`received invalid chat_id: ${ chat_id } and message_id: ${ message_id }`);
          }
        }
        catch (e) {
          console.error("error at _userMsgCashClean : ", e.message);
        }
      }
      userIdCash.msgCashClean();
    }
  }

  async _userMsgCashCleanAll (userId) {
    const userIdCash = this._getUserIdCash(userId);
    const msgCashArr = userIdCash.getMsgCash();
    const msgKBCashArr = userIdCash.getKBMsgCash();
    const msgInKBCashArr = userIdCash.getInKBMsgCash();

    const auxMsgCash = msgCashArr.concat(msgKBCashArr, msgInKBCashArr).filter(obj => !!obj.chat_id);

    for (const { chat_id, message_id } of auxMsgCash) {
      await this.botHandler.deleteMessage(chat_id, message_id);
    }

    userIdCash.cashKBMsg();
    userIdCash.cashInKBMsg();
    userIdCash.msgCashClean();
  }

  async handleRegularKey(chat_id, message_id, userId, msgText) {
    const { mainMenu, topicsMenu } = _.getRegularKeyboardObj();
    const isSpec = userId.toString() === specId.toString();

    const actionsObj = {
      [mainMenu.articles]: async () => {
        await this.botHandler._sendMessage(chat_id, "Выберите тему статей:", {
          reply_markup: {
            keyboard: this.topicsKeyboardMarkup,
            resize_keyboard: true
          }
        })
            .then(async msgRes => {
              await this._updateKbMsgCash(userId, this._getMsgResultData(msgRes));
              await setTimeout(() => {
                this._userMsgCashClean(userId);
              }, 500);
            });
      },
      [mainMenu.articleAdd]: async () => {
        const userIdCash = this._getUserIdCash(userId);
        /**
         * Making the object for the temporal new article to be filled with the required properties
         * Every action for creation article will clean previous params with new object
         */
        userIdCash.createArticleDraft();

        await this.botHandler._sendMessage(chat_id, "Заполните поля для новой статьи:", {
          reply_markup: {
            inline_keyboard: _.get_inline_keyboard_articles_add(),
          }
        })
            .then(async msgResult => {
              this._cashInKbMsg(userId, this._getMsgResultData(msgResult));
              await setTimeout(() => {
                this._userMsgCashClean(userId);
              }, 500);
            });
      },
      [mainMenu.favorite]: async () => {
        this._userInKBMsgCashClean(userId);
        await this._userMsgCashClean(userId);

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

            await this.botHandler.sendArticle(chat_id, article,{
              reply_markup: {
                inline_keyboard: _.get_inline_keyboard_articles({
                  ...params,
                }),
              }
            })
                .then(msgResult => {
                  this._cashMsg(userId, this._getMsgResultData(msgResult))
                });
          }
        }
        else {
          await this.botHandler._sendMessage(chat_id, `Список *Избранного* пуст...`)
              .then(msgResult => this._cashMsg(userId, this._getMsgResultData(msgResult)));
        }
      },
      [topicsMenu.back]: async () => {
        await this._returnToMainKeyboard(chat_id, userId);
      }
    };

    if (msgText in actionsObj) {
      await actionsObj[msgText]();
    }
  }

  async handleMessage(msg) {
    try {
      const message_id = msg.message_id;
      const chat_id = msg.chat.id;
      const userId = msg.from.id.toString(); //converting from number
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

        const userIdCashPrev = this.usersCash.get(userId);
        if (userIdCashPrev) {
          //cleaning the messages of the previous session
          await this._userMsgCashCleanAll(userId);
        }

        const userIdCash = new UserCash(userId);
        //creating new cash fot userId

        //cashing data for userId
        this.usersCash.set(userId, userIdCash);

        //cashing message
        this._cashMsg(userId, { chat_id, message_id });

        await this.botHandler.welcomeUser({ chat_id, user, userLastVisit }, {
          reply_markup: {
            keyboard: _.get_regular_keyboard_markup(isSpec, "mainMenu"),
            resize_keyboard: true
          }
        })
            .then(async msgRes => {
              //changing the message with the keyboard
              await this._updateKbMsgCash(userId, this._getMsgResultData(msgRes));
              await setTimeout(() => {
                this._userMsgCashClean(userId);
              }, 500);
            });
      }
      else if (this.regularKeys.includes(msg.text)) {
        //resetting activeProp if entering the value to the property of aDraft is canceled
        this._activePropReset(userId);

        //resetting previous messages with inline keyboards
        this._userInKBMsgCashClean(userId);
        //cashing incoming message for the future cleaning
        this._cashMsg(userId, { chat_id, message_id });
        await this.handleRegularKey(chat_id, message_id, userId, msg.text);
      }
      else {
        const topicsKeys = this.topicsCollection.map(({ name }) => name);
        const foundIndex = topicsKeys.indexOf(msg.text);

        if (foundIndex !== -1) {
          //if activeProp then to clean adding value to active prop from article draft menu
          this._activePropReset(userId);
          this._cashMsg(userId, { chat_id, message_id });

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
            await this._userMsgCashClean(userId);

            for (const article of collectionArticles) {
              const isFav = userFavorites.includes(article._id);
              const params = this._getAndCashArticleInlineKBParams(article, userId, isFav, isSpec);

              await this.botHandler.sendArticle(chat_id, article, {
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
            await this.botHandler._sendMessage(chat_id, "В коллекции пусто...")
                .then(msgRes => this._cashMsg(userId, this._getMsgResultData(msgRes)));
          }
        }
        else {
          const userIdCash = this.usersCash.get(userId);

          if (userIdCash) {
            this._cashMsg(userId, { chat_id, message_id });

            const aDraft = userIdCash.getArticleDraft();
            /**
             * if article draft property is active in aDraft.activeProp, then to confirm the article draft property
             * to equal the received msg.text
             */
            if (aDraft && aDraft.activeProp) {
              const { activeProp } = aDraft;

              if (activeProp === "link") {
                const inKBMsgCash = userIdCash.getInKBMsgCash();

                log("in link loop");
                //TODO: to validate link
                aDraft.setActivePropValue(msg.text);

                await this.botHandler.checkAndSendMessageWithEmptyADraftProps(
                    inKBMsgCash.chat_id,
                    inKBMsgCash.message_id,
                    aDraft
                );

                await this.botHandler._sendMessage(chat_id, `*Ccылка сохранена...*`)
                    .then(msgRes => {
                      this._cashMsg(userId, this._getMsgResultData(msgRes));
                    });

                await setTimeout(() => {
                  this._userMsgCashClean(userId);
                }, 700);
              }
              else {
                await this.botHandler.confirmAddArticleAction(chat_id, message_id, userId, {
                  activeProp,
                  activePropValue: msg.text,
                })
                    .then(msgRes => this._cashMsg(userId, this._getMsgResultData(msgRes)));
              }
            }
            else {
              await this._returnToMainKeyboard(chat_id, userId);
            }
          }
          else {
            await this.botHandler._sendMessage(chat_id, "Нажмите на кнопку *Меню* и выберите *Cтарт*...")
                .then(msgRes => {
                  this._cashMsg(userId, this._getMsgResultData(msgRes));
                  this._cashMsg(userId, { chat_id, message_id });

                  setTimeout(() => {
                    this._userMsgCashClean(userId);
                  }, 500);
                });
          }
        }
      }
    }
    catch (e) {
      console.error("error at handleMessage", e.message);
    }
  }

  async handleQuery(query) {
    try {
      const userId = query.from.id.toString();
      const chat_id = query.message.chat.id;
      const message_id = query.message.message_id;

      const data = JSON.parse(query.data);
      const actionType = data?.tp || null;
      const articleId = data?.aId || null;
      const isConfirmed = data?.ok || null; //true|false is confirmed... null - empty;
      const propVal = data?.val || null;

      log(data, "data : ");

      const actionTypesArticlesHandles = {
        [ARTICLES.ARTICLE_FAVORITE_ADD]: async () => {
          if (isConfirmed) {
            //changing inline_keyboard to the cashed inline_keyboard...
            await this.useCashedInlineKB(articleId, chat_id, message_id, userId, {
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
            await this.botHandler.confirmArticleAction(chat_id, message_id, userId, data);
          }
        },
        [ARTICLES.ARTICLE_FAVORITE_REMOVE]: async () => {
          if (isConfirmed) {
            await this.useCashedInlineKB(articleId, chat_id, message_id, userId,{
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
            await this.botHandler.confirmArticleAction(chat_id, message_id, userId, data);
          }
        },
        [ARTICLES.ARTICLE_DELETE]: async () => {
          if (isConfirmed) {
            log("ARTICLE_DELETE confirmed...");

          }
          else {
            await this.botHandler.confirmArticleAction(chat_id, message_id, userId, data);
          }
        },
        [ARTICLES.ARTICLE_EDIT]: async () => {
          if (isConfirmed) {
            log("ARTICLE_EDIT confirmed...");
          }
          else {
            await this.botHandler.confirmArticleAction(chat_id, message_id, userId, data);
          }
        },
        [ARTICLES.ARTICLE_CANCEL]: async () => {
          await this.useCashedInlineKB(articleId, chat_id, message_id, userId);
        }
      };

      const actionTypesArticleAddHandles = {
        [ADD_ARTICLE.ADD_ARTICLE_PROP]: async () => {
          const aDraft = this._getUserADraft(userId);

          if (!propVal) {
            throw new Error(`Error at ADD_ARTICLE.ADD_ARTICLE_PROP with invalid proVal: ${ propVal }`);
          }

          //using .set activeProp(propName)
          aDraft.activeProp = propVal;

          if (propVal.toString() === "typeId") {
            const topicsDataArr = this.topicsCollection.map(topic => ({
              name: topic.name,
              typeId: topic.typeId
            }));

            await this.botHandler.editMessageText("Выберите тематику для новой статьи: ", {
              chat_id,
              message_id,
              reply_markup: {
                inline_keyboard: _.get_inline_keyboard_topics(topicsDataArr),
              }
            })
          }
          else {
            await this.botHandler._sendMessage(chat_id, `Введите ${ addArticleMenu[propVal] }`)
                .then(msgRes => this._cashMsg(userId, this._getMsgResultData(msgRes)));
          }
        },
        [ADD_ARTICLE.ADD_ARTICLE_PROP_SET]: async () => {
          const userIdCash = this._getUserIdCash(userId);
          const aDraft = userIdCash.getArticleDraft();
          const inKBMsgCash = userIdCash.getInKBMsgCash();
          const { activeProp } = aDraft;
          //saving propVal to the aDraft active property
          //TODO: to validate propVal for each aDraft property
          aDraft.setActivePropValue(propVal);

          let pName;
          let pVal;

          if (activeProp === "typeId") {
            const targetObj = findObjFromArrByProp(this.topicsCollection, { typeId: propVal });
            pName = targetObj.name;
            pVal = pName;
          }
          else {
            pName = aDraft.getMenuKey(activeProp);
            pVal = propVal;
          }

          await Promise.all([
            this.botHandler._answerCallbackQuery(
                query.id,
                `В поле "${ pName }" сохранено значение: "${ pVal }"`
            ),
            this.botHandler.checkAndSendMessageWithEmptyADraftProps(
                inKBMsgCash.chat_id,
                inKBMsgCash.message_id,
                aDraft
            ),
          ]);

          await setTimeout(() => {
            this._userMsgCashClean(userId);
          }, 500);
        },
        [ADD_ARTICLE.ADD_ARTICLE_PROP_CANCEL]: async () => {
          const aDraft = this._getUserADraft(userId);
          this._activePropReset(userId);
          await this.botHandler.checkAndSendMessageWithEmptyADraftProps(chat_id, message_id, aDraft);
        },
        [ADD_ARTICLE.ADD_ARTICLE_SUBMIT]: async () => {
          const aDraft = this._getUserADraft(userId);

          if (aDraft.getEmptyProps().length) {
            await this.botHandler.checkAndSendMessageWithEmptyADraftProps(chat_id, message_id, aDraft);
          }
          else {
            const aDraftData = aDraft.getADraftData();

            await this.dbHandler.saveNewArticle(aDraftData)
                .then(async () => {
                  const userIdCash = this._getUserIdCash(userId);
                  userIdCash.clearArticleDraft();
                  //inline add article menu will be cashed then removed on
                  this._cashMsg(userId, { chat_id, message_id });

                  await this._returnToMainKeyboard(chat_id, userId);
                  await this.botHandler._answerCallbackQuery(
                      query.id,
                      `*Новая Статья сохранена...*`
                  );
                });
          }
        },
        [ADD_ARTICLE.ADD_ARTICLE_CANCEL]: async () => {
          const userIdCash = this._getUserIdCash(userId);
          userIdCash.clearArticleDraft();

          //await this.botHandler.deleteMessage(chat_id, message_id);
          await this._cashMsg(userId, { chat_id, message_id });
          await this.botHandler._answerCallbackQuery(
              query.id,
              `Новая статья отменена...`
          );
          await this._returnToMainKeyboard(chat_id, userId);
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
      console.error("error at handleQuery", e.message);
    }
  }

  async useCashedInlineKB (articleId, chat_id, message_id, userId, params={}) {
    //getting the cashed data for creating the inline_keyboard of a particular message with the Article
    const auxData = this._getInlineKeyboardData(userId, articleId);

    await this.botHandler.editMessageReplyMarkup({
      inline_keyboard: _.get_inline_keyboard_articles({
        ...auxData,
        ...params,
      })
    }, {
      chat_id,
      message_id
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
      console.error(e.message);
    }
  }
};


///////////DEV
function log(it, comments = "value: ") {
  console.log(comments, it);
}