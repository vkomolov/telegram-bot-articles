/**
 * these controllers are used for the models
 * @type {{getCollection: *, checkUserAndRegister: *, getDocumentsByProp: *}}
 */

module.exports = {
  getCollection,
  getDocumentsByProp,
  checkUserAndRegister
};

async function getCollection(options = {}) {
  /**
   * showBy: {
   *   name: 1,
   *   description: 1
   * }
   * @type {*|{}}
   */
  const showBy = options?.showBy || {};


  /**
   * how to sort
   * @example params.sortBy = {
   *   name: 1,
   *   title: 1
   * }
   */
  const sortBy = options?.sortBy || {};

  return await this.find({}, showBy)
      .sort(sortBy).exec();
}
//
/**
 *
 * @param {Object} prop: {name: "hello"}: property by which to find the documents
 * @param {Object} options
 * @returns {Promise<*>}
 */
async function getDocumentsByProp(prop, options={}) {
  /**
   * showBy: {
   *   name: 1,
   *   description: 1
   * }
   * @type {*|{}}
   */
  const showBy = options?.showBy || {};

  return await this
      .find(
          { prop },
          showBy
      ).exec();
}

async function checkUserAndRegister (incomingUser) {
  const { userId } = incomingUser;
  let userLastVisit;

  const userData = await this.findOne({ userId }); //5764807790

  if (userData) {
    userLastVisit = userData.last_visit;
    //refreshing last_visit
    userData.last_visit = Date.now();
    userData.save().then(() => log("document saved with new lastVisitDate..."));

    return {
      userData,
      userLastVisit
    }
  } else {
    const newUser = await new this(incomingUser).save();

    return {
      userData: newUser,
      userLastVisit: null
    }
  }
}




///////////DEV
function log(it, comments = "value: ") {
  console.log(comments, it);
}