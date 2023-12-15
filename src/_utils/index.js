const axios = require('axios');
/////////////////

module.exports.objectStringify = function (obj) {
  return JSON.stringify(obj, null, 4)
};

module.exports.findObjFromArrByProp = function (objArr, params) {
  if (objArr.length && Object.keys(params).length) {
    const paramEntries = Object.entries(params);

    return objArr.find(item => {
      let cycleBool = false;

      /**
       * if params have several props to search by, then to search for each paramEntry and to return the item,
       * which has cycleBool to be true
       */
      paramEntries.forEach(([key, val]) => {

        if (key in item) {
          cycleBool = item[key] === val;
        }
      });

      return cycleBool;
    });
  }
};

module.exports.getEmptyKeys = function (object) {
  return Object.keys(object).filter(key => !object[key]);
};

module.exports.splitArrBy = function splitArrayBy(arr, splitLimit = 2) {
  if (!splitLimit) {
    return arr;
  }

  const result = [];
  let currentGroup = [];

  for (const item of arr) {
    if (currentGroup.length === splitLimit) {
      result.push(currentGroup);
      currentGroup = [];
    }
    currentGroup.push(item);
  }

  if (currentGroup.length > 0) {
    result.push(currentGroup);
  }

  return result;
};

module.exports.flattenArray = function (arr) {
  return arr.reduce((accumulator, currentValue) => {
    if (Array.isArray(currentValue)) {
      return accumulator.concat(flattenArray(currentValue));
    } else {
      return accumulator.concat(currentValue);
    }
  }, []);
};

module.exports.flattenObject = function flattenObject (obj) {
  const result = [];

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object") {
      result.push(...flattenObject(value));
    } else {
      result.push(value);
    }
  }

  return result;
};

/**
 * It compares two objects with no checking of their references
 * @param {Object} targetObj
 * @param {Object}auxObj
 * @returns {boolean}
 */
module.exports.isEqualObject = function (targetObj, auxObj) {
  const targetKeys = Object.keys(targetObj);
  const auxKeys = Object.keys(auxObj);

  if (targetKeys.length !== auxKeys.length) {
    return false;
  }

  for (let i = 0; i < targetKeys.length; i++) {
    const key = targetKeys[i];

    if (!auxObj[key] || targetObj[key] !== auxObj[key]) {
      return false;
    }
  }

  return true;
};

function isBase64Encoded (string) {
  try {
    return Buffer.from(string, "base64").toString("base64") === string;
  } catch (e) {
    return false;
  }
}
module.exports.isBase64Encoded = isBase64Encoded;

module.exports.getBytesLength = function (string) {
  if (isBase64Encoded(string)) {
    return Buffer.byteLength(string, "base64");
  } else {
    return Buffer.byteLength(string, "utf8");
  }
};

module.exports.isValidImageLink = async function (imageLink) {
  if (imageLink && imageLink.length) {
    try {
      const response = await axios.head(imageLink);
      return response.status === 200 && response.headers?.['content-type']?.includes('image');
    } catch (error) {
      console.error(`Error at _utils.isValidImageLink with link: ${ imageLink }: `, error.message);
      return false;
    }
  }
  console.error(`not valid imageLink: ${ imageLink } at _utils.isValidImageLink...`);
  return false;
};

function formatTimeEnding(timeUnit = ["единица", "единицы", "единиц"]) {
  return function(number) {
    if (number % 100 >= 11 && number % 100 <= 19) {
      return timeUnit[2];
    } else if (number % 10 === 1) {
      return timeUnit[0];
    } else if (number % 10 >= 2 && number % 10 <= 4) {
      return timeUnit[1];
    } else {
      return timeUnit[2];
    }
  };
}

module.exports.phraseTime = function (milliseconds) {
  if (milliseconds && milliseconds > 0) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    const bySeconds = (s) => `${s} ${formatTimeEnding(['секунда', 'секунды', 'секунд'])(s)}`;
    const byMinutes = (m) => `${m} ${formatTimeEnding(['минута', 'минуты', 'минут'])(m)}`;
    const byHours = (h) => `${h} ${formatTimeEnding(['час', 'часа', 'часов'])(h)}`;
    const byDays = (d) => `${d} ${formatTimeEnding(['день', 'дня', 'дней'])(d)}`;
    const byWeeks = (w) => `${w} ${formatTimeEnding(['неделя', 'недели', 'недель'])(w)}`;
    const byMonths = (m) => `${m} ${formatTimeEnding(['месяц', 'месяца', 'месяцев'])(m)}`;
    const byYears = (y) => `${y} ${formatTimeEnding(['год', 'года', 'лет'])(y)}`;

    if (years >= 1) {
      return `${byYears(years)} ${byMonths(months % 12)} ${byWeeks(weeks % 4)} ${byDays(days % 7)} 
      ${byHours(hours % 24)} ${byMinutes(minutes % 60)} и ${bySeconds(seconds % 60)}`;
    }
    else if (months >= 1) {
      return `${byMonths(months)} ${byWeeks(weeks % 4)} ${byDays(days % 7)} ${byHours(hours % 24)} 
      ${byMinutes(minutes % 60)} и ${bySeconds(seconds % 60)}`;
    }
    else if (weeks >= 1) {
      return `${byWeeks(weeks)} ${byDays(days % 7)} ${byHours(hours % 24)} ${byMinutes(minutes % 60)} и 
      ${bySeconds(seconds % 60)}`;
    }
    else if (days >= 1) {
      return `${byDays(days)} ${byHours(hours % 24)} ${byMinutes(minutes % 60)} и ${bySeconds(seconds % 60)}`;
    }
    else if (hours >= 1) {
      return `${byHours(hours)} ${byMinutes(minutes % 60)} и ${bySeconds(seconds % 60)}`;
    }
    else if (minutes >= 1) {
      return `${byMinutes(minutes)} и ${bySeconds(seconds % 60)}`;
    }
    else {
      return `Вы отсутствовали ${bySeconds(seconds)}`;
    }
  } else {
    console.error(`not correct time given to phraseTime: ${milliseconds}`);
  }
};


///////////DEV
function log(it, comments = "value: ") {
  console.log(comments, it);
}
