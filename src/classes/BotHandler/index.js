const TelegramBot = require("node-telegram-bot-api");
const _ = require("../../config");
const { isValidImageLink, phraseTime } = require("../../_utils");

const { token, specId } = process.env;
const { parser } = require('html-metadata-parser');

//TODO: dictionary for the UI
const dictBotHandler = {
  "ru": "русский",
  "ua": "українська",
  "en": "english"
};
////////////////////////////////

module.exports = class BotHandler {
  constructor() {
    this.bot = null;
    this.parse_mode = "Markdown";

  }

  /**
   * @description It deletes the message from Telegram API
   * @param {string} chat_id: Telegram chat_id
   * @param {string} message_id: Telegram message_id
   * @returns {Promise<void>}
   * @private
   */
  async _deleteMessage (chat_id, message_id) {
    await this.bot.deleteMessage(chat_id, message_id);
  }

  /**
   * @description It edits the message with the particular message_id
   * @param {string} newText: text to replace with
   * @param {string} chat_id: Telegram chat_id
   * @param {string} message_id: Telegram message_id
   * @param {Object} reply_markup params
   * @returns {Promise<*>}
   */
  async editMessageText (newText, { chat_id, message_id, reply_markup = {} }) {
    //TODO: validation of newText
    if (newText.trim().length) {
      return await this.bot.editMessageText(newText.trim(), {
        chat_id,
        message_id,
        parse_mode: this.parse_mode,
        reply_markup,
      });
    }
  }

  /**
   * @description It edit the reply_markup the of the message with the particular message_id
   * @param {Object} newReplyMarkup: new reply_markup to replace with
   * @param {string} chat_id: Telegram chat_id
   * @param {string} message_id: Telegram message_id
   * @returns {Promise<void>}
   */
  async editMessageReplyMarkup (newReplyMarkup, { chat_id, message_id } ) {
    try {
      await this.bot.editMessageReplyMarkup({
        ...newReplyMarkup
      }, {
        chat_id,
        message_id
      })
    } catch (e) {
      console.error("error at _editMessageReplyMarkup", e);
    }
  }

  /**
   * @description It gives user the possibility to confirm the values he enters for menu actions
   * @param {string} chatId: Telegram chat_id
   * @param {string} msgId: Telegram message_id
   * @param {string} userId: Telegram user ID
   * @param {Object} callback_data: will be sent at confirmation or cancel
   * @returns {Promise<void>}
   */
  async confirmArticleAction (chatId, msgId, userId, callback_data) {
    try {
      const { ARTICLES } = _.getActionTypes();
      //giving confirm status
      const cbDataTrue = {
        ...callback_data,
        "ok": true
      };

      const { aId } = cbDataTrue;

      const cbDataFalse = {
        tp: ARTICLES.ARTICLE_CANCEL,
        uId: userId,
        aId,
      };

      await this.editMessageReplyMarkup({
        inline_keyboard: [
            ..._.getConfirmationMarkup(userId, cbDataTrue, cbDataFalse),
        ]
      }, {
        chat_id: chatId,
        message_id: msgId
      });
    }
    catch (e) {
      console.error("error at getConfirmationMarkup: ", e);
    }
  }

  /**
   * @description It gives user the possibility to confirm the values he enters for adding new article data
   * @param {string} chatId: Telegram chat_id
   * @param {string} msgId: Telegram message_id
   * @param {string} userId: Telegram user ID
   * @param {string} activeProp: the property of the article draft to be filled with the value sent by user
   * @param {string} activePropValue: the value of the article draft to be saved to the active property of the
   * article draft...
   * @returns {Promise<void>}
   */
  async confirmAddArticleAction (chatId, msgId, userId, { activeProp, activePropValue }) {

    const { ADD_ARTICLE } = _.getActionTypes();
    const { addArticleMenu } = _.getMenuKeys();

    if (!addArticleMenu[activeProp]) {
      throw new Error(`Error at confirmAddArticleAction with activeProp: ${ activeProp }`);
    }

    const cbDataTrue = {
      tp: ADD_ARTICLE.ADD_ARTICLE_PROP_SET,
    };
    const cbDataFalse = {
      tp: ADD_ARTICLE.ADD_ARTICLE_PROP_CANCEL,
    };

    const params = {
      reply_markup: {
        inline_keyboard: [
          ..._.getConfirmationMarkup(userId, cbDataTrue, cbDataFalse),
        ]
      }
    };

    const confirmMessage = `Подтвердите запись значения: *"${ activePropValue }"*`;

    return await this._sendMessage(chatId, confirmMessage, params);
  }

  /**
   * @description It sends the message to Telegram API
   * @param {string} chatId: Telegram chat_id
   * @param {string} textMessage: the text of the message to be sent to Telegram API
   * @param {Object} params: additional params of the message to sent
   * @returns {Promise}
   * @private
   */
  _sendMessage (chatId, textMessage, params={}) {
    try {
      const auxParams = {
        parse_mode: this.parse_mode,
        ...params,
      };

      if (this.bot) {
        return this.bot.sendMessage(chatId, textMessage, auxParams);
      }
      else {
        console.error("this bot is not initiated... ");
      }
    }
    catch(e) {
      console.error("error at sendMessage", e);
    }
  }

  /**
   * @description: it sends photo with the data to Telegram API, then it checks the resource for the image in the
   * meta data of the site... if no image in meta.og, then to use the default image source
   * @param {string} chatId: Telegram chat_id
   * @param {Object} article: the data of the internet resource
   * @param {Object} params: aditional params of the message to be sent
   * @returns {Promise}
   */
  sendArticle(chatId, article, params={}) {
    try {
      const reply_markup = params?.reply_markup || {};

      const articleHeading = `Название статьи: ${ article?.name || "Неизвестно..." }`;
      const articleDescription = `Описание статьи: ${ article?.description || "Отсутствует..." }`;

      const totalMessage = `${ articleHeading } \n${ articleDescription }`;
      const picDefault = "https://devby.io/storage/images/50/85/44/91/derived/d43d698b57d948929798843e9095d6cd.jpg";

      return this.bot.sendPhoto(chatId, picDefault, {
        caption: totalMessage,
        parse_mode: this.parse_mode,
        reply_markup
      })
          .then(async sentMsgResult => {
            if(sentMsgResult) {
              //object with chat_id and message_id of the message sent...
              const msgRes = this.getMsgResultData(sentMsgResult);

              try {
                const metadata = await parser(article.link);
                if (metadata && metadata.og) {
                  const metaTitle = metadata.og?.title || "";
                  const metaDescription = metadata.og?.description || "";
                  const metaImage = metadata.og?.image || null;

                  //checking the link for the response.headers['content-type'].includes('image')
                  const isImageLinkValid = await isValidImageLink(metaImage);
                  const media = isImageLinkValid ? metaImage : picDefault;

                  const resCaption = totalMessage
                      + (metaTitle.length ? `\n\n${ metaTitle }` : ``)
                      + (metaDescription.length ? `\n${ metaDescription }` : ``);

                  const timeMark = new Date().toLocaleTimeString();

                  await this.bot.editMessageMedia({
                    type: "photo",
                    media,
                    caption: `${ timeMark }: ${ resCaption }`
                  }, {
                    chat_id: msgRes.chat_id,
                    message_id: msgRes.message_id,
                    parse_mode: this.parse_mode,
                    reply_markup
                  });
                }

                return msgRes;
              }
              catch (e) {
                console.error(`error at parsing the link ${article.link} at botHandler.sendArticle`, e);
                return msgRes;
              }
            }
            else {
              console.error("received undefined from bot.sendPhoto");
            }
          });
    }
    catch (e) {
      console.error(e);
    }
  }

  /**
   * @description It returns the data of sent message
   * @param {Object} sentMsgResult: the result from the sent message
   * @returns {{message_id: String, chat_id: String}|null}
   */
  getMsgResultData (sentMsgResult) {
    if (sentMsgResult?.chat?.id && sentMsgResult?.message_id) {
      return {
        chat_id: sentMsgResult.chat.id,
        message_id: sentMsgResult.message_id,
      };
    }
    else {
      console.error(`no necessary properties found at _getMsgResultData: 
      chat.id: ${ sentMsgResult?.chat?.id }, message_id.: ${ sentMsgResult?.message_id }..`);
      console.error("returned result from Telegram: ", sentMsgResult);

      return null;
    }
  }

  /**
   * @description It initiates the Telegram Bot and starts handling messages and queries
   * @param {Function} handleMessage
   * @param {Function} handleQuery
   * @returns {Promise<void>}
   */
  async initBot ({ handleMessage, handleQuery }) {
    try {
      this.bot = await new TelegramBot(token, {
        //polling: true
        polling: {
          interval: 300,
          autoStart: true,
          params: {
            timeout: 300
          }
        }
      });

      console.log("The Telegram bot has been started...");

      this.bot.on("message", async msg => await handleMessage(msg));

      this.bot.on("callback_query", async query => await handleQuery(query));


    } catch (e) {
      console.error("error at initBot", e);
    }
  }

  /**
   * @description: it sends the greeting message on handling message "/Start"
   * @param {string} chatId: Telegram chat_id
   * @param {Object} user: current user data
   * @param {number} userLastVisit: the timestamp of the last user`s visit
   * @param {Object} reply_markup of the keyboard
   * @returns {Promise<void>}
   */
  async welcomeUser ({ chat_id, user, userLastVisit }, { reply_markup }) {
    const { first_name, last_name, userId, language_code } = user;
    const isSpec = userId.toString() === specId.toString();
    const userName = `${ first_name } ${ last_name }`;

    const specMsg = isSpec
        ? `Поскольку Вы владелец, Вам даны дополнительные функции *добавления*, *удаления* и *редакции ресурсов* в списке`
        : ``;

    const timeDiff = ((Date.now() - userLastVisit)).toFixed(1);
    const timeDiffText = phraseTime(timeDiff);

    const hello = userLastVisit
        ? `С возвращением, *${ userName }*!
        \nЯзык Вашей системы: *${ dictBotHandler[language_code] }*
        \nВы отсутствовали ${ timeDiffText }.
        \n${ specMsg }`
        : `Похоже, *${ userName }*, Вы у нас впервые!!! \nДобро пожаловать!!!
        \nЯзык Вашей системы: *${ dictBotHandler[language_code] }*
        \nЗдесь находится перечень ресурсов в виде интернет-ссылок, которые Вы можете выбрать для чтения...
        \nИли добавить ссылку в *Избранные* для чтения в будущем...
        \nВ разделе *Избранные* Вы можете изучить ссылку или удалить ее...
        \nВыберите команду для начала работы:`;


    return await this.bot.sendMessage(
        chat_id,
        hello,
        {
          parse_mode: this.parse_mode,
          reply_markup
        });

  }

  /**
   * @description: It answers to the callbackQuery
   * @param {string} queryId
   * @param {string} msgText to be sent
   * @returns {Promise<void>}
   * @private
   */
  async _answerCallbackQuery (queryId, msgText) {
    await this.bot.answerCallbackQuery(queryId, {
      text: msgText,
      show_alert: false
    })
  }

  /**
   * @description: It checks the article draft properties and returns the empty props if they are...
   * @param {string} chat_id: Telegram chat_id
   * @param {string} message_id: Telegram message_id
   * @param {Object} aDraft: the article draft with the properties of the new internet resource
   * @returns {Promise<void>}
   */
  async checkAndSendMessageWithEmptyADraftProps (chat_id, message_id, aDraft) {
    const emptyPropsArr = aDraft.getEmptyProps();

    const timeMark = new Date().toLocaleTimeString();
    //telegram rejects the same message with editMessageText: here we use time mark for editing the same message
    const msgText = !emptyPropsArr.length
        ? `${ timeMark }: \nВсе поля заполнены. Нажмите "Готово"`
        : `${ timeMark }: Остались пустые поля: \n*${ emptyPropsArr.join(`,\n`) }*`;

    await this.editMessageText(msgText, {
      chat_id,
      message_id,
      reply_markup: {
        inline_keyboard: _.get_inline_keyboard_articles_add()
      }
    });
  }
};




///////////DEV
function log(it, comments = "value: ") {
  console.log(comments, it);
}