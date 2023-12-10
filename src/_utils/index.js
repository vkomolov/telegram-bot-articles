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


///////////DEV
function log(it, comments = "value: ") {
  console.log(comments, it);
}
