const TelegramBot = require("node-telegram-bot-api");
const _ = require("../../config");
const { isValidImageLink } = require("../../_utils");

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

  async _deleteMessage (chat_id, message_id) {

    await this.bot.deleteMessage(chat_id, message_id);
  }

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

                await this.bot.editMessageMedia({
                  type: "photo",
                  media,
                  caption: resCaption
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
              console.error(`error at sentMsgResult from bot.sendPhoto`, e);
              return msgRes;
            }
          });
    }
    catch (e) {
      console.error(e);
    }
  }

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

  async welcomeUser ({ chat_id, user, userLastVisit }, { reply_markup }) {
    const { first_name, last_name, userId, language_code } = user;
    const isSpec = userId.toString() === specId.toString();
    const userName = `${ first_name } ${ last_name }`;

    const specMsg = isSpec
        ? `Поскольку Вы владелец, Вам даны дополнительные функции *добавления*, *удаления* и *редакции ресурсов* в списке`
        : ``;

    const hello = userLastVisit
        ? `С возвращением, *${ userName }*!
        \nЯзык Вашей системы: *${ dictBotHandler[language_code] }*
        \nВы отсутствовали ${ ((Date.now() - userLastVisit) / 1000 / 60).toFixed(1) } мин.
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

  async _answerCallbackQuery (queryId, msgText) {
    await this.bot.answerCallbackQuery(queryId, {
      text: msgText,
      show_alert: false
    })
  }

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