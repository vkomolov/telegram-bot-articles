const { flattenObject, getBytesLength, splitArrBy } = require("../_utils");

//TODO: multiple languages...
const keyboardKeys = {
  articles: "Статьи",
  articleAdd: "Добавить статью",
  favorite: "Избранное",
  back: "Назад",
  deleteFromFaforites: "Убрать из Избранного",
  addToFaforites: "Добавить в избранное",
  followLink: "Перейти по ссылке",
  confirm: "Подтвердить",
  cancel: "Отмена",
  submit: "Готово",
  delete: "Удалить",
  addArticleName: "Название статьи",
  addArticleTypeId: "Тема статьи",
  addArticleDescription: "Описание статьи",
  addArticleLink: "Ссылка на ресурс"
};

const menuKeys = {
  mainMenu: {
    articles: keyboardKeys.articles,
    articleAdd: keyboardKeys.articleAdd,
    favorite: keyboardKeys.favorite
  },
  topicsMenu: {
    back: keyboardKeys.back
  },
  addArticleMenu: {
    name: keyboardKeys.addArticleName,
    typeId: keyboardKeys.addArticleTypeId,
    description: keyboardKeys.addArticleDescription,
    link: keyboardKeys.addArticleLink,
    cancel: keyboardKeys.cancel,
    submit: keyboardKeys.submit,
  }
};

module.exports.getDefaultArticleData = function () {
  return {
    name: null,
    typeId: null,
    description: null,
    link: null
  }
};

module.exports.getMenuKeys = function () {
  return menuKeys;
};

function getActionTypes() {
  return {
    ARTICLES: {
      ARTICLE_FAVORITE_ADD: "AFA",
      ARTICLE_FAVORITE_REMOVE: "AFR",
      ARTICLE_FAVORITE_TOGGLE: "AFT",
      ARTICLE_ADD: "AA",
      ARTICLE_DELETE: "AD",
      ARTICLE_CANCEL: "AC",
    },
    ADD_ARTICLE: {
      ADD_ARTICLE_PROP: "AAP",
      ADD_ARTICLE_PROP_SET: "AAPS",
      ADD_ARTICLE_PROP_CANCEL: "AAPC",
      ADD_ARTICLE_NAME: "AAN",
      ADD_ARTICLE_NAME_GET: "AANG",
      ADD_ARTICLE_NAME_CANCEL: "AANC",
      ADD_ARTICLE_TYPEID: "AAT",
      ADD_ARTICLE_TYPEID_GET: "AATG",
      ADD_ARTICLE_TYPEID_CANCEL: "AATC",
      ADD_ARTICLE_DESCRIPTION: "AAD",
      ADD_ARTICLE_DESCRIPTION_GET: "AADG",
      ADD_ARTICLE_LINK: "AAL",
      ADD_ARTICLE_LINK_GET: "AALG",
      ADD_ARTICLE_CANCEL: "AAC",
      ADD_ARTICLE_SUBMIT: "AAS",
    }
  };
}

module.exports.getActionTypes = getActionTypes;

module.exports.getMenuKeys = function () {
  return menuKeys;
};

module.exports.getConfirmationMarkup = function (userId, cb_dataTrue, cb_dataFalse) {
  return (
      [
        [
          {
            text: keyboardKeys.confirm,
            callback_data: JSON.stringify(cb_dataTrue)
          },
          {
            text: keyboardKeys.cancel,
            callback_data: JSON.stringify(cb_dataFalse)
          }
        ]
      ]
  );
};

module.exports.get_inline_keyboard_articles = function ({ link, articleId, isFav, isSpec }) {
  const { ARTICLES } = getActionTypes();
  const favText = isFav ? keyboardKeys.deleteFromFaforites : keyboardKeys.addToFaforites;
  const callBackTypeFav = isFav ? ARTICLES.ARTICLE_FAVORITE_REMOVE : ARTICLES.ARTICLE_FAVORITE_ADD;

  const regularInlineKeyboardMarkup = [
    [
      {
        text: favText,
        callback_data: JSON.stringify({
          tp: callBackTypeFav,
          aId: articleId,
          ok: false
        })
      },
      {
        text: keyboardKeys.followLink,
        url: link
      },
    ],
  ];

  const specInlineKeyboardMarkup = [
    [
      {
        text: keyboardKeys.delete,
        callback_data: JSON.stringify({
          tp: ARTICLES.ARTICLE_DELETE,
          aId: articleId,
          ok: false,
        })
      }
    ]
  ];

  return isSpec ? regularInlineKeyboardMarkup.concat(specInlineKeyboardMarkup) : regularInlineKeyboardMarkup;
};

module.exports.get_inline_keyboard_articles_add = function (splitBy = 2) {
  const { ADD_ARTICLE } = getActionTypes();
  const { submit, cancel, ...aDraftPropKeysObj } = menuKeys.addArticleMenu;
  const aDraftInlineKBArr = Object.keys(aDraftPropKeysObj).map(key => {
    return {
      text: aDraftPropKeysObj[key],
      callback_data: JSON.stringify({
        tp: ADD_ARTICLE.ADD_ARTICLE_PROP,
        val: key
      })
    }
  });

  const aDraftInlineKBArrSplit = splitArrBy(aDraftInlineKBArr, splitBy);

  return [
    ...aDraftInlineKBArrSplit,
    [
      {
        text: submit,
        callback_data: JSON.stringify({
          tp: ADD_ARTICLE.ADD_ARTICLE_SUBMIT
        })
      },
      {
        text: cancel,
        callback_data: JSON.stringify({
          tp: ADD_ARTICLE.ADD_ARTICLE_CANCEL
        })
      }
    ]
  ];
};

module.exports.get_inline_keyboard_topics = function (topicsDataArr, splitBy = 2) {
  //const topicsArr = splitArrBy(topicsData, 2);
  const { ADD_ARTICLE } = getActionTypes();
  const { topicsMenu, addArticleMenu } = module.exports.getMenuKeys();

  const topicsInlineDataArr = topicsDataArr.map(topicData => ({
    text: topicData.name,
    callback_data: JSON.stringify({
      tp: ADD_ARTICLE.ADD_ARTICLE_PROP_SET,
      val: topicData.typeId
    }),
  }));

  topicsInlineDataArr.push(
      {
        text: topicsMenu.back,
        callback_data: JSON.stringify({
          tp: ADD_ARTICLE.ADD_ARTICLE_PROP_CANCEL,
        })
      }
  );


  return splitArrBy(topicsInlineDataArr, splitBy);
};

module.exports.getRegularKeyboardObj = function (prop = null) {
  return prop && prop in menuKeys ? menuKeys[prop] : menuKeys;
};

module.exports.getRegularKeyboardKeys = function () {
  return flattenObject(menuKeys);
};

module.exports.get_regular_keyboard_markup = function (isSpec = false, prop = null) {
  const { mainMenu, topicsMenu } = menuKeys;

  const markup = {
    "mainMenu": [
      [mainMenu.articles],
      [mainMenu.favorite]
    ],
    "topicsMenu": [
      [topicsMenu.back]
    ],
  };

  if (isSpec) {
    markup.mainMenu[0].push(mainMenu.articleAdd);
  }

  return prop && prop in markup ? markup[prop] : markup;
};

module.exports.getBotCredentials = function () {
  return {
    botName: "MasterCityCat",
    username: "RocketsDevBot",
  }
};


///////////DEV
function log(it, comments = "value: ") {
  console.log(comments, it);
}