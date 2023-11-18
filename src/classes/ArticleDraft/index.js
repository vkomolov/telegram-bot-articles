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

    this._activeProp = null;
  }

  getMenuKey (propName) {
    const { addArticleMenu } = _.getMenuKeys();
    if (propName in addArticleMenu) {
      return addArticleMenu[propName];
    }
    else {
      throw new Error(`no prop: ${ propName } found in menuKeys...`);
    }
  }

  getEmptyProps (separ = null) {
    let emptyProps = getEmptyKeys(this.projectArticleData);
    const { addArticleMenu } = _.getMenuKeys();
    const emptyPropsArr = emptyProps.map(prop => this.getMenuKey(prop));

    if (separ && separ.length) {
      return emptyPropsArr.join(separ);
    }
    return emptyPropsArr;
  }

  getADraftData () {
    return {
      ...this.projectArticleData,
    }
  }

  get activeProp () {
    return this._activeProp;
  }

  set activeProp (propName) {

    //log(propName, "propName at activeProp: ");
    //log(this.projectArticleData, "this.projectArticleData");

    if (propName in this.projectArticleData || propName === null) {
      this._activeProp = propName;

      log(this._activeProp, "this._activeProp: ");
    }
  }

  setActivePropValue (propVal) {
    if (this.activeProp && this.activeProp in this.projectArticleData) {
      //TODO: to validate str...

      this.projectArticleData[this.activeProp] = propVal;
    }
    else {
      throw new Error("Cannot set value to the active property..., as the article draft active property is null...");
    }
  }
};


///////////DEV
function log(it, comments = "value:") {
  console.log(comments, it);
}