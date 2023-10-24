const { flattenObject, getBytesLength } = require("../_utils");

module.exports = {
  getBotCredentials,
  get_regular_keyboard_markup,
  getRegularKeyboardKeys,
  getRegularKeyboardObj,
  getActionTypes,
  get_inline_keyboard_articles,
  getConfirmationMarkup
};

//TODO: multiple languages...
const keyboardKeys = {
  articles: "Статьи",
  favorite: "Избранное",
  back: "На Главную",
  deleteFromFaforites: "Убрать из Избранного",
  addToFaforites: "Добавить в избранное",
  followLink: "Перейти по ссылке",
  confirm: "Подтвердить",
  cancel: "Отмена",
  edit: "Редактировать",
  delete: "Удалить",
};

const menuTypes = {
  mainMenu: {
    articles: keyboardKeys.articles,
    favorite: keyboardKeys.favorite
  },
  topicsMenu: {
    back: keyboardKeys.back
  }
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
      ADD_ARTICLE_DESCRIPTION: "AAD",
      ADD_ARTICLE_LINK: "AAL",
      ADD_ARTICLE_RATE: "AAR",
      ADD_ARTICLE_CANCEL: "AAC",
    }
  };
}

function getConfirmationMarkup(userId, cb_data) {
  const { ARTICLES } = getActionTypes();
  const { aId } = cb_data;

  return (
      [
        [
          {
            text: keyboardKeys.confirm,
            callback_data: JSON.stringify(cb_data)
          },
          {
            text: keyboardKeys.cancel,
            callback_data: JSON.stringify({
              tp: ARTICLES.ARTICLE_CANCEL,
              uId: userId,
              aId,
            })
          }
        ]
      ]
  );
}

function get_inline_keyboard_articles ({ link, articleId, isFav, isSpec }) {
  const actionTypes = getActionTypes().ARTICLES;
  const favText = isFav ? keyboardKeys.deleteFromFaforites : keyboardKeys.addToFaforites;
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
          tp: actionTypes.ARTICLE_EDIT,
          aId: articleId,
          ok: false,
        })
      },
      {
        text: keyboardKeys.delete,
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