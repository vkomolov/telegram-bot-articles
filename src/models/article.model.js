const mongoose = require("mongoose");
const { getCollection, getDocumentsByProp } = require("../controllers");
const { Schema } = mongoose;

const articleSchema = new Schema(
    {
      name: {
        type: String,
        required: true,
      },
      typeId: {
        type: String,
        required: true
      },
      description: {
        type: String,
        required: true
      },
      picture: {
        type: String,
        required: true,
      },
      link: {
        type: String,
        required: true,
      },
      rate: Number,
      viewed: {
        type: [{
          accountId: String,
          lastViewedDate: Number
        }],
        default: []
      }
    },
    //{ statics: Object.assign({}, controller) }
    );

//to assign the methods to the schema
//Object.assign(articleSchema.statics, { getCollection, getDocumentsByProp });


module.exports = mongoose.model("Article", articleSchema);


/////////////DEV
function log(it, comment = "log value: ") {
  console.log(comment, it);
}