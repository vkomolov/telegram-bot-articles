const BotHandler = require("../BotHandler");
const DBHandler = require("../DBHandler");
const UserCash = require("../UserCash");
const _ = require("../../config");

const { splitArrBy, findObjFromArrByProp } = require("../../_utils");

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

  /**
   * @description: It returns the cashed inline keyboard data of the particular article
   * @param {String} userId: Telegram Id of the user
   * @param {String} articleId: article id of the internet resource
   * @returns {null|[]}
   * @private
   */
  _getInlineKeyboardMap (userId, articleId) {
    const userIdCash = this.usersCash.get(userId);
    if (userIdCash) {
      const inlineKbMap = userIdCash.getArticleInlineKBParams(articleId);
      if (inlineKbMap) {
        return inlineKbMap;
      }
      else {
        console.error(`inline keyboard data is not found for the message with article id: ${ articleId }...`);
        return null;
      }
       //returns Map or null
    }
    else {
      console.error(`userIdCash is not found with user id: ${ userId } at _getInlineKeyboardMap...`);
      return null;
    }
  }

  /**
   * @description It returns the Article Draft with the empty properties, which will be filled by the user on adding new Article
   * to the DB...
   * @param {string} userId: Telegram ID of the user
   * @returns {null|Object}
   * @private
   */
  _getUserADraft (userId) {
    const userIdCash = this.usersCash.get(userId);

    if (userIdCash) {
      return userIdCash.getArticleDraft();
    }
    else {
      console.error(`the cash with the user id: ${ userId } is not found at _getUserADraft...`);
      return null;
    }
  }

  /**
   * @description It cashes or cleans the message data with the regular keyboard;
   * @param {string} userId: Telegram user ID
   * @param {Object} msgData: the message data with chat_id and message_id of the message with the regular
   * keyboard. If msgData is given, then it cashes new message data, cleaning the previous message with the
   * regular keyboard.
   * If not msgData given, then it cleans the current cash of the message with the keyboard;
   * @private
   */
  _cashOrCleanKbMsg (userId, msgData = null) {
    const userIdCash = this.usersCash.get(userId);
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

  /**
   * @description It cashes or cleans the message data with the inline keyboard;
   * @param {string} userId: Telegram user ID
   * @param {Object} msgData: the message data with chat_id and message_id of the message with the inline
   * keyboard. If msgData is given, then it cashes the new message data, cleaning the previous message with the
   * inline keyboard.
   * If not msgData given, then it cleans the current cash of the message with the inline keyboard;
   * @private
   */
  _cashOrCleanInKbMsg (userId, msgData = null) {
    const userIdCash = this.usersCash.get(userId);

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

  /**
   * @description It cleans the active property to null. It is used to handle the input of the user, when
   * he creates a new article draft. Each property of the article draft is activated, when the bot is waiting
   * for the value from the user`s message to save to the active property of the article draft...
   * @param {string} userId: Telegram user ID
   * @private
   */
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

  /**
   * @description It cashes or cleans the data of the sent/received messages...
   * @param {string} userId: Telegram user ID
   * @param {Object} msgData: the message data with chat_id and message_id of the message to cash or clean
   * @param {boolean} toClean: if true then it cleans the message data of the particular message
   * @returns {Promise<void>}
   * @private
   */
  async _cashOrCleanMsg (userId, msgData, toClean =  false) {
    const userIdCash = this.usersCash.get(userId);

    if (userIdCash) {
      if (toClean) {
        const { chat_id, message_id } = msgData;
        if (chat_id && message_id) {
          try {
            await this.botHandler._deleteMessage(chat_id, message_id);
            userIdCash.cashOrCleanMsg(msgData, toClean);
          }
          catch (e) {
            console.error(`error at _cashOrCleanMsg with chat_id: ${ chat_id }, message_id: ${ message_id }`);
            console.error("error message:", e.message);
          }
        }
        else {
          console.error("at BotArticles._cashOrCleanMsg no chat_id, message_id found in the given msgData...");
        }
      }
      else {
        userIdCash.cashOrCleanMsg(msgData, toClean);
      }
    }
    else {
      console.error(`no cash found for user id: ${ userId } with message data: ${ msgData }...`);
    }
  }

  /**
   * @description It cleans all the cashed data of the messages. It is used for cleaning the sent/received
   * messages from the cash and Telegram
   * @param {string} userId: Telegram user ID
   * @param {boolean} isAllKeyboardsIncluded: if true, it also cleans the cash of the inline and regular keyboards
   * @returns {Promise<void>}
   * @private
   */
  async _cleanAllMsgCash (userId, isAllKeyboardsIncluded=false) {
    const userIdCash = this.usersCash.get(userId);

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
              userIdCash.cashOrCleanMsg({
                chat_id,
                message_id
              }, true);
            }
            catch(e) {
              console.error(`Error at _cleanAllMsgCash with chat_id: ${ chat_id }, message_id: ${ message_id }`);
              console.error("Error message:", e.message);
              /**
               * if ETELEGRAM: 400 Bad Request: message to delete not found, then to clean the msg data, which
               * was not found in Telegram and deleted before...
               */
              if (e.message.includes("message to delete not found")) {
                userIdCash.cashOrCleanMsg({
                  chat_id,
                  message_id
                }, true);
              }
            }
          }
          else {
            console.error(`received invalid chat_id: ${ chat_id } or message_id: ${ message_id }`);
          }
        }
      }
    }
    else {
      console.error(`no cash found for user id: ${ userId } at _cleanAllMsgCash...`);
    }
  }

  /**
   * @description it sends the greetings message with the regular keyboard of the main menu
   * @param {string} chat_id: Telegram chat_id
   * @param {string} userId: Telegram user ID
   * @returns {Promise<void>}
   * @private
   */
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

  /**
   * @description It edits the ReplyMarkup of the message with the particular inline keyboard of the article
   * @param {string} articleId: article id of the internet resource. The articles are cashed separately from
   * the regular messages...
   * @param {string} chat_id: Telegram chat_id
   * @param {string} message_id: Telegram message_id
   * @param {string} userId: Telegram user ID
   * @param {Object} params: additional parameters, like 'isFav'...
   * @returns {Promise<void>}
   * @private
   */
  async _useCashedInlineKb (articleId, chat_id, message_id, userId, params={}) {
    //getting cashed data for creating the inline_keyboard of a particular message with the Article
    const auxData = this._getInlineKeyboardMap(userId, articleId);

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

  /**
   * @description It sends the message with the details of the particular article and its inline keyboard data
   * @param {string} chat_id: Telegram chat_id
   * @param {Object} article: It contains the data of the particular internet resource
   * @param {Object} params: additional parameters, like 'userId, isSpec, isFav'...
   * @returns {Promise<void>}
   * @private
   */
  async _sendArticle (chat_id, article, params) {
    if (article && article._id.toString().length) {
      const articleId = article._id.toString();  //converting from ObjectId()
      const { userId, isSpec, isFav } = params;

      const articleData = {
        link: article.link,
        articleId,
        isFav,
        isSpec
      };
      //it returns UserCash instance
      const userIdCash = this.usersCash.get(userId);
      if (userIdCash) {
        userIdCash.cashArticleInlineKBParams(articleId, articleData);

        this.botHandler.sendArticle(chat_id, article,{
          reply_markup: {
            inline_keyboard: _.get_inline_keyboard_articles({
              ...articleData,
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
      else {
        console.error(`userIdCash is not found for userId: ${ userId }`);
      }
    }
    else {
      console.error(`incorrect article data received: ${ article }`);
    }
  }

  /**
   * @description It handles the messages with the particular text (msgText)
   * @param {string} chat_id: Telegram chat_id
   * @param {string} message_id: Telegram message_id
   * @param {string} userId: Telegram user ID
   * @param {string} msgText: received
   * @returns {Promise<void>}
   * @private
   */
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
                  //re-writing new message data with the topics menu keyboard
                  this._cashOrCleanKbMsg(userId, sentMsgRes);
                  //

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
          const userIdCash = this.usersCash.get(userId);

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

          const favorites = await this.dbHandler.getDocumentByProp(
              "User",
              {
                userId
              })
              .then(doc => doc.favorites);

          if (favorites.length) {
            for (const articleId of favorites) {
              const article = await this.dbHandler.getDocumentByProp("Article", {
                _id: articleId,
              });

              if (article && article._id) {
                this._sendArticle(chat_id, article, {
                  userId,
                  isSpec,
                  isFav: true
                });
              }
              else {
                console.error(`could not find the article with id: ${ articleId } at [mainMenu.favorite]`);
              }
            }
          }
          else {
            await this.botHandler._sendMessage(chat_id, `Список Избранного пуст...`)
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

  /**
   * @description It handles the messages with the particular text (msg)
   * @param {Object} msg: received Telegram message
   * @returns {Promise<void>}
   * @private
   */
  async _handleMessage(msg) {
    try {
      const message_id = msg.message_id;
      const chat_id = msg.chat.id;
      const userId = msg.from.id.toString(); //converting from number
      const isSpec = userId === specId.toString();
      const userIdCash = this.usersCash.get(userId);

      const { first_name, last_name, language_code } = msg.from;

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

          if (userIdCash) {
            await this._cleanAllMsgCash(userId, true);
          }

          //creating new cash fot userId
          const userIdCashNew = new UserCash(userId);

          //cashing data for userId
          this.usersCash.set(userId, userIdCashNew);

          //cashing message 'start'
          await this._cashOrCleanMsg(userId, { chat_id, message_id });

          await this.botHandler.welcomeUser({ chat_id, user, userLastVisit }, {
            reply_markup: {
              keyboard: _.get_regular_keyboard_markup(isSpec, "mainMenu"),
              resize_keyboard: true
            }
          })
              .then(msgRes => {
                const sentMsgRes = this.botHandler.getMsgResultData(msgRes);

                if (sentMsgRes) {
                  //cashing the message data with welcome message and the main menu keyboard
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
        this._cashOrCleanMsg(userId, { chat_id, message_id });
        await this._handleRegularKey(chat_id, message_id, userId, msg.text);
      }
      else {
        const topicsKeys = this.topicsCollection.map(({ name }) => name);
        const foundIndex = topicsKeys.indexOf(msg.text);

        if (foundIndex !== -1) {
          //if activeProp then to clean adding value to active prop from article draft menu
          this._activePropReset(userId);

          //cleaning previous messages
          await this._cleanAllMsgCash(userId);

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
            for (const article of collectionArticles) {
              const isFav = userFavorites.includes(article._id);
              this._sendArticle(chat_id, article, {
                userId,
                isSpec,
                isFav
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
          if (userIdCash) {
            this._cashOrCleanMsg(userId, { chat_id, message_id });

            const aDraft = userIdCash.getArticleDraft();
            /**
             * if article draft property is active in aDraft.activeProp, then to confirm the article draft property
             * to equal the received msg.text
             */
            if (aDraft && aDraft.activeProp) {
              const { activeProp } = aDraft;

              //restrictions in length: 64 Bytes

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
            await this.botHandler._sendMessage(chat_id, "Нажмите на кнопку \"Меню\" и выберите \"Cтарт\"...")
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

  /**
   * @description It handles the queries from the inline keyboards, chosen by the user;
   * @param {Object} query: Telegram query received...
   * @returns {Promise<void>}
   * @private
   */
  async _handleQuery(query) {
    try {
      const userId = query.from.id.toString();
      const chat_id = query.message.chat.id;
      const message_id = query.message.message_id;
      const userIdCash = this.usersCash.get(userId);
      const msgText = query.message.text;

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
                user.save()
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
              await this.dbHandler.deleteArticleById(userId, articleId)
                  .then(() => {
                    userIdCash.deleteArticleInlineKBParams(articleId);
                    //deleting message with article
                    this._cashOrCleanMsg(userId, {
                      chat_id,
                      message_id
                    }, true);

                    this.botHandler._answerCallbackQuery(query.id, `Ресурс удален...`);
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
            if (userIdCash) {
              const aDraft = userIdCash.getArticleDraft();
              const inKBCash = userIdCash.getInKbMsgCash();
              const auxChatId = inKBCash?.chat_id;
              const auxMsgId = inKBCash?.message_id;

              if (aDraft && aDraft.getEmptyProps().length) {
                await this.botHandler.checkAndSendMessageWithEmptyADraftProps(auxChatId, auxMsgId, aDraft);
              }
              else {
                const aDraftData = aDraft.getADraftData();

                await this.dbHandler.saveNewArticle(aDraftData)
                    .then(() => {
                      userIdCash.clearArticleDraft();
                      //inline add article menu will be cashed then cleaned later
                      this._cashOrCleanMsg(userId, { chat_id, message_id });
                      //returning to main keyboard menu
                      this._returnToMainKeyboard(chat_id, userId);
                      this.botHandler._answerCallbackQuery(
                          query.id,
                          `Новая Статья сохранена...`
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

  /**
   * @description It initiates the connection to MongoDb and the connection to Telegram bot API
   * Also it cashes the topics menu, which is taken dynamically from the list of the topics in the DB
   * @returns {Promise<void>}
   */
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