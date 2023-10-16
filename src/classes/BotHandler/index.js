const TelegramBot = require("node-telegram-bot-api");
const { getConfirmationMarkup } = require("../../config");



module.exports = class BotHandler {
  constructor(token) {
    this._token = token;
    this.bot = null;
    this.parse_mode = "Markdown"
  }

  async _deleteMessage (chat_id, message_id) {
    await this.bot.deleteMessage(chat_id, message_id)
  }

  async _editMessageReplyMarkup (newReplyMarkup, { chat_id, message_id } ) {
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

  async getConfirmation (chatId, msgId, callback_data) {
    try {
      const confirmed = {
        ...callback_data,
        "ok": true
      };

      await this._editMessageReplyMarkup({
        inline_keyboard: [
            ...getConfirmationMarkup(confirmed)
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

  async _sendMessage (chatId, textMessage, params={}) {
    try {
      const auxParams = {
        parse_mode: this.parse_mode,
        ...params,
      };

      if (this.bot) {
        await this.bot.sendMessage(chatId, textMessage, auxParams);
      }
      else {
        console.error("this bot is not initiated...");
      }
    }
    catch(e) {
      console.error("error at sendMessage", e);
    }
  }

  async _sendArticle(chatId, article, isFav, params={}) {
    try {
      const inline_keyboard = params?.inline_keyboard || [];


      const articleHeading = `*Название статьи*: ${ article?.name || "Неизвестно..." } `;
      const articleDescription = `*Описание статьи*: ${ article?.description || "Отсутствует..." }`;
      const articleLink = `[${ article.name }](${ article.link })`;

      const resMessage = `${ articleHeading } \n\n${ articleDescription } \n\n`;
      const picUrl = "https://devby.io/storage/images/50/85/44/91/derived/d43d698b57d948929798843e9095d6cd.jpg";

      await this.bot.sendPhoto(chatId, picUrl, {
        caption: resMessage,
        parse_mode: this.parse_mode,
        reply_markup: {
          inline_keyboard
        }
      })
    }
    catch (e) {
      console.error(e);
    }
  }

  async initBot ({ handleMessage, handleQuery }) {
    try {
      this.bot = await new TelegramBot(this._token, {
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

  async greetUser ({ chatId, userName, userLastVisit, isSpec, mainKeyboardMarkup }) {
    const specMsg = isSpec
        ? `\nПоскольку Вы владелец, Вам даны дополнительные функции...`
        : ``;

    const hello = userLastVisit
        ? `С возвращением, *${ userName }*! 
        \nВы отсутствовали ${ ((Date.now() - userLastVisit) / 1000 / 60).toFixed(1) } мин.
        ${ specMsg }`
        : `Похоже, *${ userName }*, Вы у нас впервые!!! \nДобро пожаловать!!!
        \nЗдесь находится перечень ресурсов в виде интернет-ссылок, которые Вы можете выбрать для чтения...
        \nИли добавить ссылку в *Избранные* для чтения в будущем...
        \nВ разделе *Избранные* Вы можете изучить ссылку или удалить ее...`;


    await this.bot.sendMessage(
        chatId,
        `${ hello } \nВыберите команду для начала работы:`,
        {
          parse_mode: this.parse_mode,
          reply_markup: {
            keyboard: mainKeyboardMarkup,
            resize_keyboard: true
          }
        });
  }
};




///////////DEV
function log(it, comments = "value: ") {
  console.log(comments, it);
}