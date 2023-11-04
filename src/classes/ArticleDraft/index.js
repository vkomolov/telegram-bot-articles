const { getEmptyKeys } = require ("../../_utils");
const _ = require("../../config");

module.exports = class ArticleDraft {
  constructor(articleData = {}) {

    this.projectArticleData = {
      name: articleData?.name || null,
      typeId: articleData?.typeId || null,
      description: articleData?.description || null,
      link: articleData?.link || null,
    };

    this.activeProp = null;
  }

  setActive(propName) {
    if (propName in this.projectArticleData) {
      this.activeProp = propName;
    }
    else {
      throw new Error(`no such property ${ propName } in the article project...`);
    }
  }

  setActivePropValue(str) {
    if (this.activeProp) {
      //TODO: to validate str...
      this.projectArticleData[this.activeProp] = str;
    }
    else {
      throw new Error("the article draft active property is null...");
    }
  }

  getEmptyProps(separ = null) {
    let emptyProps = getEmptyKeys(this.projectArticleData);
    const { addArticleMenu } = _.getMenuKeys();
    const emptyPropsArr = emptyProps.map(prop => {
      if (prop in addArticleMenu) {
        return addArticleMenu[prop];
      }
      throw new Error(`no prop: ${ prop } found in menuKeys...`);
    });

    if (separ && separ.length) {
      return emptyPropsArr.join(separ);
    }
    return emptyPropsArr;
  }

  setProp (paramsObj) {
    if (Object.keys(paramsObj).length) {
      Object.keys(paramsObj).forEach(key => {
        if (key in this.projectArticleData) {
          this.projectArticleData[key] = paramsObj[key];
        }
        else {
          console.error(`no such property ${ key } found...`);
        }
      });
    }
    else {
      console.error("given AProject param is empty...")
    }
  }
};


///////////DEV
function log(it, comments = "value: ") {
  console.log(comments, it);
}