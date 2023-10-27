const { flattenObject, getBytesLength, splitArrBy } = require("../_utils");

//TODO: multiple languages...
const keyboardKeys = {
  articles: "Статьи",
  articleAdd: "Добавить ресурс",
  favorite: "Избранное",
  back: "Назад",
  deleteFromFaforites: "Убрать из Избранного",
  addToFaforites: "Добавить в избранное",
  followLink: "Перейти по ссылке",
  confirm: "Подтвердить",
  cancel: "Отмена",
  submit: "Готово",
  edit: "Редактировать",
  delete: "Удалить",
  addArticleName: "Название статьи",
  addArticleTypeId: "Тема статьи",
  addArticleDescription: "Описание статьи",
  addArticleLink: "Ссылка на ресурс"
};

const menuTypes = {
  mainMenu: {
    articles: keyboardKeys.articles,
    articleAdd: keyboardKeys.articleAdd,
    favorite: keyboardKeys.favorite
  },
  topicsMenu: {
    back: keyboardKeys.back
  },
  addArticleMenu: {
    addArticleName: keyboardKeys.addArticleName,
    addArticleTypeId: keyboardKeys.addArticleTypeId,
    addArticleDescription: keyboardKeys.addArticleDescription,
    addArticleLink: keyboardKeys.addArticleLink,
    cancel: keyboardKeys.cancel,
    submit: keyboardKeys.submit,
  }
};

module.exports.getMenuTypes = function () {
  return menuTypes;
};

function getActionTypes () {
  return {
    ARTICLES: {
      ARTICLE_FAVORITE_ADD: "AFA",
      ARTICLE_FAVORITE_REMOVE: "AFR",
      ARTICLE_FAVORITE_TOGGLE: "AFT",
      ARTICLE_ADD: "AA",
      ARTICLE_EDIT: "AE",
      ARTICLE_DELETE: "AD",
      ARTICLE_CANCEL: "AC",
    },
    ADD_ARTICLE: {
      ADD_ARTICLE_NAME: "AAN",
      ADD_ARTICLE_TYPEID: "AAT",
      ADD_ARTICLE_TYPEID_GET: "AATG",
      ADD_ARTICLE_TYPEID_CANCEL: "AATC",
      ADD_ARTICLE_DESCRIPTION: "AAD",
      ADD_ARTICLE_LINK: "AAL",
      ADD_ARTICLE_RATE: "AAR",
      ADD_ARTICLE_CANCEL: "AAC",
      ADD_ARTICLE_SUBMIT: "AAS",
    }
  };
}
module.exports.getActionTypes = getActionTypes;

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
        text: keyboardKeys.edit,
        callback_data: JSON.stringify({
          tp: ARTICLES.ARTICLE_EDIT,
          aId: articleId,
          ok: false,
        })
      },
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

module.exports.get_inline_keyboard_articles_add = function () {
  const { ADD_ARTICLE } = getActionTypes();
  const menuKeys = menuTypes.addArticleMenu;

  return [
    [
      {
        text: menuKeys.addArticleName,
        callback_data: JSON.stringify({
          tp: ADD_ARTICLE.ADD_ARTICLE_NAME,
        })
      },
      {
        text: menuKeys.addArticleTypeId,
        callback_data: JSON.stringify({
          tp: ADD_ARTICLE.ADD_ARTICLE_TYPEID
        })
      },
    ],
    [
      {
        text: menuKeys.addArticleDescription,
        callback_data: JSON.stringify({
          tp: ADD_ARTICLE.ADD_ARTICLE_DESCRIPTION
        })
      },
      {
        text: menuKeys.addArticleLink,
        callback_data: JSON.stringify({
          tp: ADD_ARTICLE.ADD_ARTICLE_LINK
        })
      },
    ],
    [
      {
        text: menuKeys.submit,
        callback_data: JSON.stringify({
          tp: ADD_ARTICLE.ADD_ARTICLE_SUBMIT
        })
      },
      {
        text: menuKeys.cancel,
        callback_data: JSON.stringify({
          tp: ADD_ARTICLE.ADD_ARTICLE_CANCEL
        })
      }
    ]
  ];
};

module.exports.get_inline_keyboard_topics = function (topicsDataArr) {
  //const topicsArr = splitArrBy(topicsData, 2);
  const { ADD_ARTICLE } = getActionTypes();
  const { topicsMenu, addArticleMenu } = getMenuTypes();

  const topicsDataArrInline = topicsDataArr.map(topicData => ({
    text: topicData.name,
    callback_data: JSON.stringify({
      tp: ADD_ARTICLE.ADD_ARTICLE_TYPEID_GET,
      tt: topicData.typeId
    }),
  }));

  topicsDataArrInline.push(
    {
      text: topicsMenu.back,
      callback_data: JSON.stringify({
        tp: ADD_ARTICLE.ADD_ARTICLE_TYPEID_CANCEL,
      })
    }
  );

  log(topicsDataArrInline, "topicsDataArrInline: ");

  const markup = splitArrBy(topicsDataArrInline, 2);
  log(markup, "markup: ");

  //_id, name, typeId

  return markup;
};

module.exports.getRegularKeyboardObj = function (prop = null) {
  return prop && prop in menuTypes ? menuTypes[prop] : menuTypes;
};

module.exports.getRegularKeyboardKeys = function () {
  return flattenObject(menuTypes);
};

module.exports.get_regular_keyboard_markup = function (isSpec = false, prop = null) {
  const { mainMenu, topicsMenu } = menuTypes;

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