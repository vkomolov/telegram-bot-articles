const _ = require("../../config");
const ArticleDraft = require("../ArticleDraft");

module.exports = class UserCash {
  constructor(userId) {
    this.userId = userId;
    this.aDraft = null;
    this.articlesInlineKBParams = new Map();
    this.msgCash = {
      inline_kb_msg: {},
      kb_msg: {},
      msg_cash: new Map(),
    }
  }

  cashArticleInlineKBParams (articleId, params) {
    this.articlesInlineKBParams.set(articleId, params);
  }

  getArticleInlineKBParams (articleId) {
    if (this.articlesInlineKBParams.has(articleId)) {
      return this.articlesInlineKBParams.get(articleId);
    }
    else {
      console.error(`the following article id: ${ articleId } is not found in 
      articlesInlineKBParams at getArticleData...`);
      return null;
    }
  }

  deleteArticleInlineKBParams (articleId) {
    if (this.articlesInlineKBParams.has(articleId)) {
      this.articlesInlineKBParams.delete(articleId);
      return articleId;
    }
    else {
      console.error(`the following article id: ${ articleId } is not found in 
      articlesInlineKBParams at getArticleData...`);
      return null;
    }
  }

  cashOrCleanKbMsg (kbMsgData = null) {
    if (kbMsgData && kbMsgData.chat_id && kbMsgData.message_id) {
      const { chat_id, message_id } = kbMsgData;
      log(this.getKbMsgCash(), "previous KbMsgCash at UserCash.cashOrCleanKbMsg: ");
      log(`cashing new inline KbMsgCash: ${message_id}`);
      //re-writing new message with keyboard data
      Object.assign(this.msgCash.kb_msg, {
        chat_id,
        message_id
      });

      log(this.getKbMsgCash(), "new KbMsgCash at UserCash.getKbMsgCash: ");
    } else {
      //cleaning kb_msg if no arguments
      this.msgCash.kb_msg = {};
      log(this.msgCash.kb_msg, `this.msgCash.kb_msg =:`);
    }
  }

  getKbMsgCash () {
    return this.msgCash.kb_msg;
  }

  cashOrCleanInKbMsg (inKBMsgData = null) {
    if (inKBMsgData && inKBMsgData.chat_id && inKBMsgData.message_id) {
      const { chat_id, message_id } = inKBMsgData;
      log(this.getInKbMsgCash(), "previous KbMsgCash at UserCash.cashOrCleanInKbMsg: ");
      log(`cashing new inline KbMsgCash: ${message_id}`);

      Object.assign(this.msgCash.inline_kb_msg, {
        ...inKBMsgData,
      });

      log(this.getInKbMsgCash(), "new KbMsgCash at UserCash.cashOrCleanInKbMsg: ");

    } else {
      this.msgCash.inline_kb_msg = {};
      log(this.msgCash.inline_kb_msg, `this.msgCash.inline_kb_msg =:`);
    }
  }

  getInKbMsgCash () {
    return this.msgCash.inline_kb_msg;
  }

  cashOrCleanMsg(msgData, toClean = false) {
    if (msgData && msgData.chat_id && msgData.message_id) {
      const { chat_id, message_id } = msgData;

      //making unique key for the map: `${msgData.chat_id}_${msgData.message_id}`
      const mapKey = _.getKeyFromMsgData(msgData);

      if (toClean) {
        log(message_id, "message_id cleaning at cashOrCleanMsg: ");
        if (this.msgCash.msg_cash.has(mapKey)) {
          log(this.msgCash.msg_cash, `this.msgCash.msg_cash before delete : ${message_id}`);
          this.msgCash.msg_cash.delete(mapKey);

          log(this.msgCash.msg_cash.values(), `this.msgCash.msg_cash.values() after delete from msgCash : 
          ${mapKey} with ${message_id}`);
        }
        else {
          console.error(`the message data with chat_id: ${ chat_id }, message_id: ${ message_id } 
          is not found at UserCash.cashOrCleanMsg...`);
        }
      }
      else {
        log(message_id, "message_id saving at cashOrCleanMsg: ");
        this.msgCash.msg_cash.set(mapKey, msgData);
        log(this.msgCash.msg_cash, `this.msgCash.msg_cash after cashing: ${mapKey} with ${msgData.message_id}`);
      }
    }
    else {
     console.error(`no valid message data found at UserCash.cashOrCleanMsg`, msgData);
    }
  }

  getMsgCash() {
    return Array.from(this.msgCash.msg_cash.values());
  }

  cleanAllMsgCash() {
    if (this.msgCash.msg_cash.size) {
      this.msgCash.msg_cash.clear();
    }
  }

  hasMsgInCash(msgData) {
    if (msgData.chat_id && msgData.message_id) {
      return this.msgCash.msg_cash.has(msgData);
    }
  }

  getArticleDraft() {
    return this.aDraft;
  }

  createArticleDraft() {
    this.aDraft = new ArticleDraft();
  }

  clearArticleDraft() {
    this.aDraft = null;
  }
};


///////////DEV
function log(it, comments = "value: ") {
  console.log(comments, it);
}