const mongoose = require("mongoose");
const { getCollection, checkUserAndRegister  } = require("../controllers");
const Schema = mongoose.Schema;

const userSchema = new Schema(
    {
      ///id of the user in Telegram
      userId: {
        type: String,
        required: true
      },
      first_name: {
        type: String,
        required: true,
      },
      last_name: {
        type: String,
        default: null,
      },
      language_code: {
        type: String,
        required: true
      },
      last_visit: {
        type: Number,
        default: null
      },
      favorites: {
        type: [String],
        default: []
      }

    },
    //{ statics: Object.assign({}, controller) }
);

//to assign the methods to the schema
//Object.assign(userSchema.statics, { getCollection, checkUserAndRegister });

module.exports = mongoose.model("User", userSchema);