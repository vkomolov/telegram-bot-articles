const mongoose = require("mongoose");
const { getCollection, getDocumentsByProp } = require("../controllers");
const Schema = mongoose.Schema;

const topicSchema = new Schema(
    {
      name: {
        type: String,
        required: true,
      },
      description: {
        type: String,
        required: true,
      },
      typeId: {
        type: String,
        required: true,
      },
    },
    //{ statics: Object.assign({}, controller) }
);

//to assign the methods to the schema
//Object.assign(topicSchema.statics, { getCollection, getDocumentsByProp });

module.exports = mongoose.model("Topic", topicSchema);



/////////////DEV
function log(it, comment = "log value: ") {
  console.log(comment, it);
}