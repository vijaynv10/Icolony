const { text } = require('body-parser');
const { Timestamp } = require('bson');
const { number } = require('joi');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const creditnoteSchema = new Schema({
    customer:{ type:String, required: true },
    merchant:{ type:String, required: true },
    amount: { type:Number, required: true},
    creditpaid: Boolean,
    createddate:Date
});

creditnoteSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
    }
});

module.exports = mongoose.model('CreditNote', creditnoteSchema);
