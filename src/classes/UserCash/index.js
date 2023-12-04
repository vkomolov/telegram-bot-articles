const { findObjFromArrByProp } = require("../../_utils");
const ArticleDraft = require("../ArticleDraft");

module.exports = class UserCash {
  constructor(userId) {
    this.userId = userId;
    this.aDraft = null;
    this.articlesInlineKBParams = new Map();
    this.msgCash = {
      inline_kb_msg: {},
      kb_msg: {},
      msg_cash: new Set(),
    }
  }

  cashArticleData (articleId, params) {
    this.articlesInlineKBParams.set(articleId, params);
  }

  cashOrCleanKbMsg (kbMsgData = null) {
    if (kbMsgData && kbMsgData.chat_id && kbMsgData.message_id) {
      const { chat_id, message_id } = kbMsgData;

      //re-writing new message with keyboard data
      Object.assign(this.msgCash.kb_msg, {
        chat_id,
        message_id
      });
    } else {
      //cleaning kb_msg if no arguments
      this.msgCash.kb_msg = {};
    }
  }

  cashOrCleanInKbMsg (inKBMsgData = null) {
    if (inKBMsgData && inKBMsgData.chat_id && inKBMsgData.message_id) {
      const { chat_id, message_id } = inKBMsgData;

      Object.assign(this.msgCash.inline_kb_msg, {
        chat_id,
        message_id
      });
    } else {
      this.msgCash.inline_kb_msg = {};
    }
  }

  cashOrCleanMsg(msgData, toClean = false) {
    if (msgData && msgData.chat_id && msgData.message_id) {
      const { chat_id, message_id } = msgData;

      if (toClean) {
        if (this.msgCash.msg_cash.has(msgData)) {
          this.msgCash.msg_cash.delete(msgData);
        }
        else {
          console.error(`the message data with chat_id: ${ chat_id }, message_id: ${ message_id } 
          is not found at UserCash.cashOrCleanMsg...`);
        }
      }
      else {
        this.msgCash.msg_cash.add({
          chat_id,
          message_id
        });
      }
    }
    else {
     console.error(`no valid message data found at UserCash.cashOrCleanMsg`, msgData);
    }
  }

  cleanAllMsgCash() {
    if (this.msgCash.msg_cash.size) {
      this.msgCash.msg_cash.clear();
    }
  }

  getKbMsgCash () {
    return this.msgCash.kb_msg;
  }

  getInKbMsgCash () {
    return this.msgCash.inline_kb_msg;
  }

  getMsgCash() {
    return Array.from(this.msgCash.msg_cash);
  }

  hasMsgInCash(msgData) {
    if (msgData?.chat_id && msgData?.message_id) {
      return this.msgCash.msg_cash.has(msgData);
    }
  }

  getInlineKbMap(articleId) {
    return this.articlesInlineKBParams.get(articleId);
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