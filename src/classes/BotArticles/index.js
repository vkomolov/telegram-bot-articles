const BotHandler = require("../BotHandler");
const DBHandler = require("../DBHandler");
const UserCash = require("../UserCash");
const _ = require("../../config");

const { splitArrBy, getBytesLength, findObjFromArrByProp } = require("../../_utils");

const { specId } = process.env;
const { ARTICLES, ADD_ARTICLE } = _.getActionTypes();
const { addArticleMenu } = _.getMenuKeys();

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

    this.handleMessage = this._handleMessage.bind(this);
    this.handleQuery = this._handleQuery.bind(this);
  }
///END OF CONSTRUCTOR

  _getUserIdCash (userId) {
    const userIdCash = this.usersCash.get(userId);
    if (!userIdCash) {
      console.error(`no user cash with user id: ${ userId } found...`);
      return null;
      //throw new Error(`no user cash with user id: ${ userId } found...`);
    }

    return userIdCash;
  }

  _getAndCashArticleInlineKbParams (article, userId, isFav, isSpec) {
    const articleId = article._id.toString();  //converting from ObjectId()
    //it returns UserCash instance
    const userIdCash = this._getUserIdCash(userId);
    const params = {
      link: article.link,
      articleId,
      isFav,
      isSpec
    };

    if (userIdCash) {
      userIdCash.cashArticleData(articleId, params);
      return params;
    }

    console.error(`the cash under id: ${ userId } is not found at _getAndCashArticleInlineKbParams...`);
    return params;
  }

  _getInlineKeyboardData (userId, articleId) {
    const userIdCash = this._getUserIdCash(userId);
    if (userIdCash) {
      const inlineKb = userIdCash.getInlineKbMap(articleId) || null;
      if (!inlineKb) {
        console.error(`inline keyboard data is not found for the message with article id: ${ articleId }...`);
      }
      return inlineKb; //returns Map or null
    }

    console.error(`userIdCash is not found with user id: ${ userId } at _getInlineKeyboardData...`);
    return null;
  }

  _getUserADraft (userId) {
    const userIdCash = this._getUserIdCash(userId);

    if (userIdCash) {
      return userIdCash.getArticleDraft();
    }
    else {
      console.error(`the cash with the user id: ${ userId } is not found at _getUserADraft...`);
      return null;
    }
  }

  _cashOrCleanKbMsg (userId, msgData = null) {
    const userIdCash = this._getUserIdCash(userId);
    if (userIdCash) {
      const prevKbMsgCash = {
        ...userIdCash.getKbMsgCash()
      };

      if (prevKbMsgCash.chat_id && prevKbMsgCash.message_id) {
        //cashing for future delete with _cleanAllMsgCash
        userIdCash.cashOrCleanMsg({
          chat_id: prevKbMsgCash.chat_id,
          message_id: prevKbMsgCash.message_id
        });
      }

      if (msgData && msgData.chat_id && msgData.message_id) {
        //updating with new keyboard message data
        userIdCash.cashOrCleanKbMsg({ ...msgData });
      }
      else {
        //cleaning kbMsgCash
        userIdCash.cashOrCleanKbMsg();
      }
    }
    else {
      console.error(`no cash found for user id: ${ userId } with message data: ${ msgData }...`);
    }
  }

  _cashOrCleanInKbMsg (userId, msgData = null) {
    const userIdCash = this._getUserIdCash(userId);

    if (userIdCash) {
      const prevInKbMsgCash = {
        ...userIdCash.getInKbMsgCash()
      };

      if (prevInKbMsgCash.chat_id && prevInKbMsgCash.message_id) {
        //cashing for future delete with _cleanAllMsgCash
        userIdCash.cashOrCleanMsg({
          chat_id: prevInKbMsgCash.chat_id,
          message_id: prevInKbMsgCash.message_id
        });
      }

      if (msgData && msgData.chat_id && msgData.message_id) {
        //updating with new keyboard message data
        userIdCash.cashOrCleanInKbMsg({ ...msgData });
      }
      else {
        //cleaning inKbMsgCash when no arguments...
        userIdCash.cashOrCleanInKbMsg();
      }
    }
    else {
      console.error(`no cash found for user id: ${ userId } with message data: ${ msgData }...`);
    }
  }

  _activePropReset (userId) {
    const userIdCash = this.usersCash.get(userId);
    if (userIdCash) {
      const aDraft = userIdCash.getArticleDraft();
      if (aDraft && aDraft.activeProp) {
        aDraft.activeProp = null;
        aDraft.activePropDraftValue = null;
      }
    }
    else {
      console.error(`no message cash is found for user id: ${ userId } at _activePropReset...`);
    }
  }

  async _cashOrCleanMsg (userId, msgData, toClean =  false) {
    const userIdCash = this._getUserIdCash(userId);

    if (userIdCash) {
      if (toClean) {
        const { chat_id, message_id } = msgData;
        if (chat_id && message_id && userIdCash.hasMsgInCash(msgData)) {
          try {
            await this.botHandler._deleteMessage(chat_id, message_id);
          }
          catch (e) {
            console.error(`error at _cashOrCleanMsg with chat_id: ${ chat_id }, message_id: ${ message_id }`);
            console.error("error message:", e.message);
          }
        }
      }

      userIdCash.cashOrCleanMsg(msgData, toClean);
    }
    else {
      console.error(`no cash found for user id: ${ userId } with message data: ${ msgData }...`);
    }
  }

  //TODO: error happens deleting msg with chat_id, message_id = undefined "not found to delete"
  async _cleanAllMsgCash (userId, isAllKeyboardsIncluded=false) {
    const userIdCash = this._getUserIdCash(userId);

    if (userIdCash) {
      if (isAllKeyboardsIncluded) {
        //cleaning msg data of keyboard and inline_keyboard
        this._cashOrCleanKbMsg(userId);
        this._cashOrCleanInKbMsg(userId);
      }

      const msgCashArr = userIdCash.getMsgCash();

      if (msgCashArr.length) {
        for (const { chat_id, message_id } of msgCashArr) {
          if (chat_id && message_id) {
            try {
              await this.botHandler._deleteMessage(chat_id, message_id);
            }
            catch(e) {
              console.error(`error at _cleanAllMsgCash with chat_id: ${ chat_id }, message_id: ${ message_id }`);
              console.error("error message:", e.message);
            }
          }
          else {
            console.error(`received invalid chat_id: ${ chat_id } or message_id: ${ message_id }`);
          }
        }
        //after await fulfilled and messages deleted, to clear userId message cash
        userIdCash.cleanAllMsgCash();
      }
    }
    else {
      console.error(`no cash found for user id: ${ userId } at _cleanAllMsgCash...`);
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
        .then(msgRes => {
          const sentMsgRes = this.botHandler.getMsgResultData(msgRes);
          if (sentMsgRes) {
            this._cashOrCleanKbMsg(userId, sentMsgRes);

            setTimeout(() => {
              this._cleanAllMsgCash(userId);
            }, 300);
          }
          else {
            console.error(`received null from the sent message at _returnToMainKeyboard... `);
          }
        });
  }

  async _useCashedInlineKb (articleId, chat_id, message_id, userId, params={}) {
    //getting cashed data for creating the inline_keyboard of a particular message with the Article
    const auxData = this._getInlineKeyboardData(userId, articleId);

    if (auxData) {
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
    else {
      console.error(`inline keyboard data for the message with the article id is not found for user id: ${ userId }, 
      and article id: ${ articleId }`);
    }
  }

  async _handleRegularKey(chat_id, message_id, userId, msgText) {
    const { mainMenu, topicsMenu } = _.getRegularKeyboardObj();
    const isSpec = userId.toString() === specId.toString();

    const actionsObj = {
      [mainMenu.articles]: async () => {
        try {
          await this.botHandler._sendMessage(chat_id, "Выберите тему статей:", {
            reply_markup: {
              keyboard: this.topicsKeyboardMarkup,
              resize_keyboard: true
            }
          })
              .then(msgRes => {
                const sentMsgRes = this.botHandler.getMsgResultData(msgRes);

                if (sentMsgRes) {
                  this._cashOrCleanKbMsg(userId, sentMsgRes);
                  setTimeout(() => {
                    this._cleanAllMsgCash(userId);
                  }, 300);
                }
                else {
                  console.error(`received null from the sent message at _returnToMainKeyboard... `);
                }
              });
        }
        catch(e) {
          console.error(`error at _handleRegularKey/mainMenu.articles:`, e.message);
        }
      },
      [mainMenu.articleAdd]: async () => {
        try {
          const userIdCash = this._getUserIdCash(userId);

          if (userIdCash) {
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
                .then(msgRes => {
                  const sentMsgRes = this.botHandler.getMsgResultData(msgRes);

                  if (sentMsgRes) {
                    this._cashOrCleanInKbMsg(userId, sentMsgRes);

                    setTimeout(() => {
                      this._cleanAllMsgCash(userId);
                    }, 300);
                  }
                  else {
                    console.error(`received null from the sent message at _returnToMainKeyboard... `);
                  }
                });
          }
          else {
            console.error(`no user cash with user id: ${ userId } found...`);
          }
        }
        catch(e) {
          console.error(`error at _handleRegularKey/mainMenu.articleAdd:`, e.message);
        }
      },
      [mainMenu.favorite]: async () => {
        try {
          //cleaning message data with inline_keyboard...
          this._cashOrCleanInKbMsg(userId);
          //cleaning all regular messages cashed...
          await this._cleanAllMsgCash(userId);

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
              const params = this._getAndCashArticleInlineKbParams(article, userId, true, isSpec);

              this.botHandler.sendArticle(chat_id, article,{
                reply_markup: {
                  inline_keyboard: _.get_inline_keyboard_articles({
                    ...params,
                  }),
                }
              })
                  .then(msgRes => {
                    if (msgRes && msgRes.chat_id && msgRes.message_id) {
                      this._cashOrCleanMsg(userId, msgRes);
                    }
                    else {
                      console.error(`received null from the sent message at _returnToMainKeyboard... `);
                    }
                  });
            }
          }
          else {
            await this.botHandler._sendMessage(chat_id, `Список *Избранного* пуст...`)
                .then(msgRes => {
                  const sentMsgRes = this.botHandler.getMsgResultData(msgRes);

                  if (sentMsgRes) {
                    this._cashOrCleanInKbMsg(userId, sentMsgRes);

                    setTimeout(() => {
                      this._cleanAllMsgCash(userId);
                    }, 300);
                  }
                  else {
                    console.error(`received null from the sent message at _returnToMainKeyboard... `);
                  }
                });
          }
        }
        catch(e) {
          console.error(`error at _handleRegularKey/mainMenu.favorite:`, e.message);
        }
      },
      [topicsMenu.back]: async () => {
        try {
          await this._returnToMainKeyboard(chat_id, userId);
        }
        catch(e) {
          console.error(`error at _handleRegularKey/mainMenu.back:`, e.message);
        }
      }
    };

    if (msgText in actionsObj) {
      await actionsObj[msgText]();
    }
  }

  async _handleMessage(msg) {
    try {
      const message_id = msg.message_id;
      const chat_id = msg.chat.id;
      const userId = msg.from.id.toString(); //converting from number
      const isSpec = userId === specId.toString();

      const { first_name, last_name, is_bot, language_code } = msg.from;

      ////CONDITIONS
      if (msg.text.startsWith("/start")) {
        try {
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
          }

          const userIdCashPrev = this.usersCash.get(userId);

          if (userIdCashPrev) {
            await this._cleanAllMsgCash(userId, true);
          }
          //creating new cash fot userId
          const userIdCash = new UserCash(userId);

          //cashing data for userId
          this.usersCash.set(userId, userIdCash);

          //cashing message 'start'
          this._cashOrCleanMsg(userId, { chat_id, message_id });

          await this.botHandler.welcomeUser({ chat_id, user, userLastVisit }, {
            reply_markup: {
              keyboard: _.get_regular_keyboard_markup(isSpec, "mainMenu"),
              resize_keyboard: true
            }
          })
              .then(msgRes => {
                const sentMsgRes = this.botHandler.getMsgResultData(msgRes);

                if (sentMsgRes) {
                  this._cashOrCleanKbMsg(userId, sentMsgRes);

                  setTimeout(() => {
                    this._cleanAllMsgCash(userId);
                  }, 300);
                }
                else {
                  console.error(`received null from the sent message at _returnToMainKeyboard... `);
                }
              });
        }
        catch (e) {
          console.error('error on handling message with "start": ', e.message);
        }
      }
      else if (this.regularKeys.includes(msg.text)) {
        //resetting activeProp if entering the value to the property of aDraft is canceled
        this._activePropReset(userId);

        //resetting previous messages with inline keyboards
        this._cashOrCleanInKbMsg(userId);

        //cashing incoming message for the future cleaning
        //TODO:revise cash cleaning
        this._cashOrCleanMsg(userId, { chat_id, message_id });
        await this._handleRegularKey(chat_id, message_id, userId, msg.text);
      }
      else {
        const topicsKeys = this.topicsCollection.map(({ name }) => name);
        const foundIndex = topicsKeys.indexOf(msg.text);

        if (foundIndex !== -1) {
          //if activeProp then to clean adding value to active prop from article draft menu
          this._activePropReset(userId);

          //TODO:revise cash cleaning
          this._cashOrCleanMsg(userId, { chat_id, message_id });

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

            //TODO:revise cash cleaning
            await this._cleanAllMsgCash(userId);

            for (const article of collectionArticles) {
              const isFav = userFavorites.includes(article._id);
              const params = this._getAndCashArticleInlineKbParams(article, userId, isFav, isSpec);

              this.botHandler.sendArticle(chat_id, article, {
                reply_markup: {
                  inline_keyboard: _.get_inline_keyboard_articles({
                    ...params,
                  }),
                }
              })
                  .then(msgRes => {
                    if (msgRes && msgRes.chat_id && msgRes.message_id) {
                      this._cashOrCleanMsg(userId, msgRes);
                    }
                    else {
                      console.error(`received null from the sent message at _returnToMainKeyboard... `);
                    }
                  });
            }
          }
          else {
            await this.botHandler._sendMessage(chat_id, "В коллекции пусто...")
                .then(msgRes => {
                  const sentMsgRes = this.botHandler.getMsgResultData(msgRes);

                  if (sentMsgRes) {
                    this._cashOrCleanMsg(userId, sentMsgRes);
                  }
                  else {
                    console.error(`received null from the sent message at _returnToMainKeyboard... `);
                  }
                });
          }
        }
        else {
          const userIdCash = this.usersCash.get(userId);

          if (userIdCash) {
            this._cashOrCleanMsg(userId, { chat_id, message_id });

            const aDraft = userIdCash.getArticleDraft();
            /**
             * if article draft property is active in aDraft.activeProp, then to confirm the article draft property
             * to equal the received msg.text
             */
            if (aDraft && aDraft.activeProp) {
              const { activeProp } = aDraft;

              //restrictions in length: 64 Bytes TODO: to solve restrictions...

              aDraft.activePropDraftValue = msg.text;

              await this.botHandler.confirmAddArticleAction(chat_id, message_id, userId, {
                activeProp,
                activePropValue: msg.text,
              })
                  .then(msgRes => {
                    const sentMsgRes = this.botHandler.getMsgResultData(msgRes);

                    if (sentMsgRes) {
                      this._cashOrCleanMsg(userId, sentMsgRes);
                    }
                    else {
                      console.error(`received null from the sent message at _returnToMainKeyboard... `);
                    }
                  });
            }
            else {
              await this._returnToMainKeyboard(chat_id, userId);
            }
          }
          else {
            await this.botHandler._sendMessage(chat_id, "Нажмите на кнопку *Меню* и выберите *Cтарт*...")
                .then(msgRes => {
                  const sentMsgRes = this.botHandler.getMsgResultData(msgRes);

                  if (sentMsgRes) {
                    setTimeout(() => {
                      this.botHandler._deleteMessage(sentMsgRes.chat_id, sentMsgRes.message_id);
                      this.botHandler._deleteMessage(chat_id, message_id);
                    }, 1500);
                    //this._cashOrCleanMsg(userId, sentMsgRes);
                  }
                  else {
                    console.error(`received null from the sent message at _returnToMainKeyboard... `);
                  }
                });
          }
        }
      }
    }
    catch (e) {
      console.error("error at _handleMessage", e.message);
    }
  }

  async _handleQuery(query) {
    try {
      const userId = query.from.id.toString();
      const chat_id = query.message.chat.id;
      const message_id = query.message.message_id;

      const data = JSON.parse(query.data);
      const actionType = data?.tp || null;
      const articleId = data?.aId || null;
      const isConfirmed = data?.ok || null; //true|false is confirmed... null - empty;
      const propVal = data?.val || null;

      const actionTypesArticlesHandles = {
        [ARTICLES.ARTICLE_FAVORITE_ADD]: async () => {
          try {
            if (isConfirmed) {
              //changing inline_keyboard to the cashed inline_keyboard...
              await this._useCashedInlineKb(articleId, chat_id, message_id, userId, {
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
          }
          catch (e) {
            console.error(`error at _handleQuery/ARTICLES.ARTICLE_FAVORITE_ADD: `, e.message);
          }
        },
        [ARTICLES.ARTICLE_FAVORITE_REMOVE]: async () => {
          try {
            if (isConfirmed) {
              await this._useCashedInlineKb(articleId, chat_id, message_id, userId,{
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
          }
          catch (e) {
            console.error(`error at _handleQuery/ARTICLES.ARTICLE_FAVORITE_REMOVE: `, e.message);
          }
        },
        [ARTICLES.ARTICLE_DELETE]: async () => {
          try {
            if (isConfirmed) {
              await this.dbHandler.deleteArticleById(articleId)
                  .then(() => {
                    setTimeout(async () => {
                      await this.botHandler._answerCallbackQuery(query.id, `Ресурс удален...`);

                      this._cleanAllMsgCash(userId);
                    }, 700);
                  });
            }
            else {
              await this.botHandler.confirmArticleAction(chat_id, message_id, userId, data);
            }
          }
          catch(e) {
            console.error(`error at _handleQuery/ARTICLES.ARTICLE_DELETE: `, e.message);
          }
        },
        [ARTICLES.ARTICLE_CANCEL]: async () => {
          await this._useCashedInlineKb(articleId, chat_id, message_id, userId);
        }
      };

      const actionTypesArticleAddHandles = {
        [ADD_ARTICLE.ADD_ARTICLE_PROP]: async () => {
          try {
            const aDraft = this._getUserADraft(userId);

            if (propVal && aDraft) {
              //using .set activeProp(propName)
              aDraft.activeProp = propVal;
              aDraft.activePropDraftValue = null;

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
                    .then(msgRes => {
                      const sentMsgRes = this.botHandler.getMsgResultData(msgRes);

                      if (sentMsgRes) {
                        this._cashOrCleanMsg(userId, sentMsgRes);
                      }
                      else {
                        console.error(`received null from the sent message at _returnToMainKeyboard... `);
                      }
                    });
              }
            }
            else {
              //throw new Error(`Error at ADD_ARTICLE.ADD_ARTICLE_PROP with invalid proVal: ${ propVal }`);
              console.error(`Error at ADD_ARTICLE.ADD_ARTICLE_PROP with proVal: ${ propVal } 
            and the article project draft: ${ aDraft }`);
            }
          }
          catch (e) {
            console.error(`error at _handleQuery/ADD_ARTICLE.ADD_ARTICLE_PROP: `, e.message);
          }
        },
        [ADD_ARTICLE.ADD_ARTICLE_PROP_SET]: async () => {
          try {
            const userIdCash = this._getUserIdCash(userId);

            if (userIdCash) {
              const aDraft = userIdCash.getArticleDraft();
              const inKBMsgCash = userIdCash.getInKbMsgCash();

              const { activeProp, activePropDraftValue } = aDraft;
              if (activeProp) {
                //saving propVal to the aDraft active property
                //TODO: to validate propVal for each aDraft property
                let pName;
                let pVal;

                if (activeProp === "typeId") {
                  const targetObj = findObjFromArrByProp(this.topicsCollection, { typeId: propVal });
                  pName = targetObj.name;
                  pVal = propVal;
                }
                else {
                  pName = aDraft.getMenuKey(activeProp);
                  pVal = activePropDraftValue || null;
                }

                if (pVal) {
                  aDraft.setActivePropValue(pVal);
                  const auxVal = activeProp === "typeId" ? pName : pVal;

                  await Promise.all([
                    this.botHandler._answerCallbackQuery(
                        query.id,
                        `В поле "${ pName }" сохранено значение: "${ auxVal }"`
                    ),
                    this.botHandler.checkAndSendMessageWithEmptyADraftProps(
                        inKBMsgCash.chat_id,
                        inKBMsgCash.message_id,
                        aDraft
                    ),
                  ]);
                }
                else {
                  console.error(`setting active property with invalid value: ${ pVal } at ADD_ARTICLE_PROP_SET`)
                }

                this._activePropReset(userId);

                setTimeout(() => {
                  this._cleanAllMsgCash(userId);
                }, 300);
              }
              else {
                console.error(`activeProp: ${ activeProp } is not valid...`);
              }
            }
            else {
              console.error(`no message cash found for the id: ${ userId }...`);
            }
          }
          catch (e) {
            console.error(`error at _handleQuery/ADD_ARTICLE.ADD_ARTICLE_PROP_SET: `, e.message);
          }
        },
        [ADD_ARTICLE.ADD_ARTICLE_PROP_CANCEL]: async () => {
          try {
            const userIdCash = this._getUserIdCash(userId);

            if (userIdCash) {
              const aDraft = userIdCash.getArticleDraft();
              const inKBCash = userIdCash.getInKbMsgCash();
              const auxChatId = inKBCash?.chat_id || chat_id;
              const auxMsgId = inKBCash?.message_id || message_id;

              this._activePropReset(userId);
              await this.botHandler.checkAndSendMessageWithEmptyADraftProps(auxChatId, auxMsgId, aDraft);

              setTimeout(() => {
                this._cleanAllMsgCash(userId);
              }, 300);
            }
            else {
              console.error(`no message cash found for the id: ${ userId }...`);
            }
          }
          catch (e) {
            console.error(`error at _handleQuery/ADD_ARTICLE.ADD_ARTICLE_PROP_CANCEL: `, e.message);
          }
        },
        [ADD_ARTICLE.ADD_ARTICLE_SUBMIT]: async () => {
          try {
            const userIdCash = this._getUserIdCash(userId);

            if (userIdCash) {
              const aDraft = userIdCash.getArticleDraft();
              const inKBCash = userIdCash.getInKbMsgCash();
              const auxChatId = inKBCash?.chat_id || chat_id;
              const auxMsgId = inKBCash?.message_id || message_id;

              if (aDraft && aDraft.getEmptyProps().length) {
                await this.botHandler.checkAndSendMessageWithEmptyADraftProps(auxChatId, auxMsgId, aDraft);
              }
              else {
                const aDraftData = aDraft.getADraftData();

                await this.dbHandler.saveNewArticle(aDraftData)
                    .then(async () => {
                      const userIdCash = this._getUserIdCash(userId);
                      userIdCash.clearArticleDraft();
                      //inline add article menu will be cashed then removed on
                      this._cashOrCleanMsg(userId, { chat_id, message_id });

                      await this._returnToMainKeyboard(chat_id, userId);
                      await this.botHandler._answerCallbackQuery(
                          query.id,
                          `*Новая Статья сохранена...*`
                      );
                    });
              }
            }
            else {
              console.error(`no message cash found for the id: ${ userId }...`);
            }
          }
          catch(e) {
            console.error(`error at _handleQuery/ADD_ARTICLE.ADD_ARTICLE_SUBMIT: `, e.message);
          }
        },
        [ADD_ARTICLE.ADD_ARTICLE_CANCEL]: async () => {
          try {
            const userIdCash = this._getUserIdCash(userId);

            if (userIdCash) {
              userIdCash.clearArticleDraft();

              await this._cashOrCleanMsg(userId, { chat_id, message_id });
              await this.botHandler._answerCallbackQuery(
                  query.id,
                  `Новая статья отменена...`
              );
              await this._returnToMainKeyboard(chat_id, userId);
            }
            else {
              console.error(`no message cash found for the id: ${ userId }...`);
            }
          }
          catch (e) {
            console.error(`error at _handleQuery/ADD_ARTICLE.ADD_ARTICLE_CANCEL: `, e.message);
          }
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
      console.error("error at _handleQuery", e.message);
    }
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
      console.error(`error at BotArticles/start: `, e.message);
    }
  }
};


///////////DEV
function log(it, comments = "value: ") {
  console.log(comments, it);
}