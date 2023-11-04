
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


///////////DEV
function log(it, comments = "value: ") {
  console.log(comments, it);
}
