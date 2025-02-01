const { text } = require('body-parser');
const { Timestamp } = require('bson');
const { number } = require('joi');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cartitemschema = new Schema({
    productid: { type: String, required: true},
    variantid: { type: String, required: true},
    quantity: { type: Number, required: true }
});

const cartSchema = new Schema({
    customerid: { type:String},
    merchantid: { type:String},
    items: { type:[cartitemschema]},
    amount:{ type: Number, required: true },
});

cartSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
    }
});

module.exports = mongoose.model('Cart', cartSchema);
