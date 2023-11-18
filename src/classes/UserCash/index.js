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

  cashInKBMsg (inKBMsgData = null) {
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

  getInKBMsgCash () {
    return this.msgCash.inline_kb_msg;
  }

  cashKBMsg (kbMsgData = null) {
    if (kbMsgData && kbMsgData.chat_id && kbMsgData.message_id) {
      const { chat_id, message_id } = kbMsgData;

      Object.assign(this.msgCash.kb_msg, {
        chat_id,
        message_id
      });
    } else {
      this.msgCash.kb_msg = {};
    }
  }

  getKBMsgCash () {
    return this.msgCash.kb_msg;
  }

  cashMsg({ chat_id, message_id }) {
    this.msgCash.msg_cash.add({
      chat_id,
      message_id
    });
  }

  msgCashClean() {
    if (this.msgCash.msg_cash.size) {
      this.msgCash.msg_cash.clear();
    }
  }

  getMsgCash(params = {}) {
    const msgCashArr = Array.from(this.msgCash.msg_cash);

    if (Object.keys(params).length) {
      return findObjFromArrByProp(msgCashArr, params);
    }
    return msgCashArr;
  }

  getInlineKBMap(articleId) {
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