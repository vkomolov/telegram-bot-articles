const mongoose = require("mongoose");
//bluebird gives correct and optimized promises to mongoose
mongoose.Promise = require("bluebird");

const Article = require("../../models/article.model");
const User = require("../../models/user.model");
const Topic = require("../../models/topic.model");

const { baseUrl } = process.env;

module.exports = class DBHandler {
  constructor() {
    this._db = null;
    this.Article = Article;
    this.User = User;
    this.Topic = Topic;
  }

  async connectDb (options) {
    try {
      this._db = await mongoose.connect(baseUrl, options);

      console.log("the database is connected...");
    }
    catch (e) {
      console.error("at connectDb:", e);
    }
  }

  /**
   * @param {string} modelName: the name of the dataBase Model "Topic", "Article", "User"
   * @param {Object} targetProp: { userId: "someId" }: property by which to find the documents
   * @param {Object} option
   *
   * @returns {Promise<*>}
   */
  async getCollectionByModel (modelName, targetProp = {}, option = {}) {
    try {
      /** option
       * showBy: {
       *   name: 1,
       *   description: 1
       * }
       * @type {*|{}}
       */
      const showBy = option?.showBy || {};

      /**
       * how to sort
       * @example params.sortBy = {
       *   name: 1,
       *   title: 1
       * }
       */
      const sortBy = option?.sortBy || {};

      const mName = modelName[0].toUpperCase() + modelName.toLowerCase().slice(1);
      const ModelName = this[mName] || null;

      if (ModelName) {
        //any Model of this
        return await ModelName.find({...targetProp}, showBy)
            .sort(sortBy).exec();
      }
      else {
        console.error(`could not find ${ mName } in models at getCollectionByProp...`);
        return null;
      }
    }
    catch (e) {
      console.error('error at getCollectionByModel: ', e);
    }
  }

  async getDocumentByProp (modelName, targetProp = {}) {
    try {
      const mName = modelName[0].toUpperCase() + modelName.toLowerCase().slice(1);
      const ModelName = this[mName] || null;

      if (ModelName) {

        //any Model of this
        return await ModelName.findOne({...targetProp}).exec();
      }
      else {
        console.error(`could not find ${ mName } in models at getCollectionByProp...`);
        return null;
      }
    }
    catch (e) {
      console.error("error at getDocumentByProp", e);
    }
  }

/*  const incomingUser = {
    userId,
    first_name,
    last_name,
    language_code,
    last_visit: Date.now(),
    favorites: []
  };*/

  /**
   * It checks the Telegram userId of the user to be in the User collection.
   * If true it updates the last_visit property of the user to Date.now();
   * It the Telegram userId is not listed in User Collection, then to save new user to the User collection;
   * @param {Object} incomingUser
   * @param {string} incomingUser.userId
   * @param {string} incomingUser.first_name
   * @param {string} incomingUser.last_name
   * @param {string} incomingUser.language_code
   * @param {number} incomingUser.last_visit
   * @param {[string]} incomingUser.favorites : ids of the articles, which were set in favorite
   * @param {Object} params: option params
   *
   * @returns {Promise<{userData: *, userLastVisit: null}|{userLastVisit: *, user: *}>}
   */
  async checkUserAndSave (incomingUser, params={}) {
    try {
      const {
        userId, first_name, last_name, language_code,
        last_visit, favorites
      } = incomingUser;

      const user = await this.User.findOne({ userId }); //'5764807790' string

      if (user) {
        let userLastVisit = user.last_visit;
        //refreshing last_visit
        user.last_visit = Date.now();
        await user.save();

        return {
          user,
          userLastVisit
        }
      }
      else {
        const newUser = await new this.User(incomingUser).save();
        //TODO: to make validation of the new user properties

        console.log(`new user ${ userId } is saved...`);

        //for the new user the userLastVisit must be null
        return {
          user: newUser,
          userLastVisit: null
        }
      }
    }
    catch(e) {
      console.error('error at checkUserAndSave: ', e)
    }
  }

  async saveNewArticle (articleData) {
    return await new this.Article(articleData).save();
  }

  async deleteArticleById (userId, articleId) {
    try {
      await Promise.all([
        this.User.updateMany({}, { $pull: { favorites: articleId } }),
        this.Article.deleteOne({ _id: articleId })
      ]);
    }
    catch (e) {
      console.error(`error at deleteArticleById with userId: ${ userId }, articleId: ${ articleId }`);
    }
  }
};





///////////DEV
  function log(it, comments = "value: ") {
    console.log(comments, it);
  }