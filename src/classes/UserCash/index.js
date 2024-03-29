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

  /**
   * @description: it cashes the inline keyboard params of the particular article
   * @param {string} articleId
   * @param {Object} params: inline keyboard params
   */
  cashArticleInlineKBParams (articleId, params) {
    this.articlesInlineKBParams.set(articleId, params);
  }

  /**
   * @description It returns the params of the articles with the inline keyboard
   * @param {string} articleId
   * @returns {null|Object}
   */
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

  /**
   * @description It cleans the data of the particular article from the cash
   * @param {string} articleId
   * @returns {null|string}
   */
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

  /**
   * @description: it cashes the regular keyboard params of the particular message
   * @param {Object} kbMsgData: data of the regular keyboard. If kbMsgData is undefined,
   * then to clean this.msgCash.kb_msg to {}, else to cash the data to this.msgCash.kb_msg
   */
  cashOrCleanKbMsg (kbMsgData) {
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

  /**
   * @description: it returns the cash of the message with the regular keyboard...
   * @returns {UserCash.msgCash.kb_msg|{}}
   */
  getKbMsgCash () {
    return this.msgCash.kb_msg;
  }

  /**
   * @description: it cashes the inline keyboard params of the particular message
   * @param {Object} inKBMsgData: data of the message with inline keyboard. If inKBMsgData is undefined,
   * then to clean this.msgCash.inline_kb_msg to {}, else to cash the data to this.msgCash.inline_kb_msg
   */
  cashOrCleanInKbMsg (inKBMsgData = null) {
    if (inKBMsgData && inKBMsgData.chat_id && inKBMsgData.message_id) {
      Object.assign(this.msgCash.inline_kb_msg, {
        ...inKBMsgData,
      });
    } else {
      this.msgCash.inline_kb_msg = {};
    }
  }

  /**
   * @description: It returns the data of the message with the inline keyboard
   * @returns {Object}
   */
  getInKbMsgCash () {
    return this.msgCash.inline_kb_msg;
  }

  /**
   * It cashes and cleans the data of the messages sent or received...
   * @param {Object} msgData: the data of the message
   * @param {boolean} toClean: if true then to clean the data of the particular message, else to cash the data
   * of the message
   */
  cashOrCleanMsg(msgData, toClean = false) {
    if (msgData && msgData.chat_id && msgData.message_id) {
      const { chat_id, message_id } = msgData;

      //making unique key for the map: `${msgData.chat_id}_${msgData.message_id}`
      const mapKey = _.getKeyFromMsgData(msgData);

      if (toClean) {
        if (this.msgCash.msg_cash.has(mapKey)) {
          this.msgCash.msg_cash.delete(mapKey);
        }
        else {
          console.error(`the message data with chat_id: ${ chat_id }, message_id: ${ message_id } 
          is not found at UserCash.cashOrCleanMsg...`);
        }
      }
      else {
        this.msgCash.msg_cash.set(mapKey, msgData);
      }
    }
    else {
     console.error(`no valid message data found at UserCash.cashOrCleanMsg`, msgData);
    }
  }

  /**
   * @description: it returns the array of the cashed message data, sent or received
   * @returns {Array}
   */
  getMsgCash() {
    return Array.from(this.msgCash.msg_cash.values());
  }

  /**
   * @description: it clears all the data of the regular messages sent/received...
   * the cash of the messages with inline or regular keyboard are cashed separately///
   */
  cleanAllMsgCash() {
    if (this.msgCash.msg_cash.size) {
      this.msgCash.msg_cash.clear();
    }
  }

  /**
   * @description It checks if the particular message data is cashed
   * @param {Object} msgData: target message data with message_id and chat_id
   * @returns {boolean}
   */
  hasMsgInCash(msgData) {
    if (msgData.chat_id && msgData.message_id) {
      return this.msgCash.msg_cash.has(msgData);
    }
  }

  /**
   * @description: it returns the article draft data of a new internet resource...
   * @returns {null|Object}
   */
  getArticleDraft() {
    return this.aDraft;
  }

  /**
   * @description: It creates the article draft with the default empty properties of the Article Model
   */
  createArticleDraft() {
    this.aDraft = new ArticleDraft();
  }

  /**
   * @description: it clears the data of the article draft for the new resource
   */
  clearArticleDraft() {
    this.aDraft = null;
  }
};


///////////DEV
function log(it, comments = "value: ") {
  console.log(comments, it);
}