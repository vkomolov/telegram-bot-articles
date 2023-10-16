const { flattenObject, getBytesLength } = require("../_utils");


module.exports = {
  getBotCredentials,
  get_regular_keyboard_markup,
  getRegularKeyboardKeys,
  getRegularKeyboardObj,
  getActionTypesArticles,
  get_inline_keyboard_articles,
  getConfirmationMarkup
};

const menuTypes = {
  mainMenu: {
    articles: "Статьи",
    favorite: "Избранное"
  },
  topicsMenu: {
    back: "На Главную"
  }
};

function getActionTypesArticles () {
  return {
    ARTICLE_FAVORITE_ADD: "afa",
    ARTICLE_FAVORITE_REMOVE: "afr",
    ARTICLE_FAVORITE_TOGGLE: "aft",
    ARTICLE_ADD: "aa",
    ARTICLE_EDIT: "ae",
    ARTICLE_DELETE: "ad",
  };
}

function getConfirmationMarkup(cb_data) {

  log(cb_data, "cb_data: ");

  return (
      [
        [
          {
            text: "Подтвердить",
            callback_data: JSON.stringify(cb_data)
          },
          {
            text: "Отмена",
            callback_data: "cancel"
          }
        ]
      ]
  );
}

function get_inline_keyboard_articles ({ link, articleId, isFav, isSpec }) {
  const actionTypes = getActionTypesArticles();
  const favText = isFav ? "Убрать из Избранного" : "Добавить в избранное";
  const callBackTypeFav = isFav ? actionTypes.ARTICLE_FAVORITE_REMOVE : actionTypes.ARTICLE_FAVORITE_ADD;


  const generalInlineKeyboardMarkup = [
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
        text: "Перейти по ссылке",
        url: link
      },
    ],
  ];

  const specInlineKeyboardMarkup = [
    [
      {
        text: "Edit",
        callback_data: JSON.stringify({
          tp: actionTypes.ARTICLE_EDIT,
          aId: articleId,
          ok: false,
        })
      },
      {
        text: "Delete",
        callback_data: JSON.stringify({
          tp: actionTypes.ARTICLE_DELETE,
          aId: articleId,
          ok: false,
        })
      }
    ]
  ];

  return isSpec ? generalInlineKeyboardMarkup.concat(specInlineKeyboardMarkup) : generalInlineKeyboardMarkup;
}

function getRegularKeyboardObj(prop = null) {
  return prop && prop in menuTypes ? menuTypes[prop] : menuTypes;
}

function getRegularKeyboardKeys() {
  return flattenObject(menuTypes);
}

function get_regular_keyboard_markup (prop = null) {
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

  return prop && prop in markup ? markup[prop] : markup;
}

function getBotCredentials () {
  return {
    botName: "MasterCityCat",
    username: "RocketsDevBot",
  }
}






///////////DEV
function log(it, comments = "value: ") {
  console.log(comments, it);
}