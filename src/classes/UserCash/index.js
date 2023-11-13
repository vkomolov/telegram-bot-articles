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

  cashInKBMsg ({ chatId, msgId }) {
    Object.assign(this.msgCash.inline_kb_msg, {
      chatId,
      msgId
    })
  }

  getInKBMsgCash () {
    return this.msgCash.inline_kb_msg;
  }

  cashKBMsg ({ chatId, msgId }) {
    Object.assign(this.msgCash.kb_msg, {
      chatId,
      msgId
    })
  }

  getKBMsgCash () {
    return this.msgCash.kb_msg;
  }


  cashMsg({ chatId, msgId }) {
    this.msgCash.msg_cash.add({
      chatId,
      msgId
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
};


///////////DEV
function log(it, comments = "value: ") {
  console.log(comments, it);
}