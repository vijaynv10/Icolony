const { text } = require('body-parser');
const { Timestamp } = require('bson');
const { number } = require('joi');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const customfieldSchema = new Schema({
    fieldname: { type: String, required: true},
    fieldvalue: { type: String, required: true},
});

const invoicecustomfieldsSchema = new Schema({
    merchant:{ type:String, required: true },
    customfields: { type:[customfieldSchema]},
});

invoicecustomfieldsSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
    }
});

module.exports = mongoose.model('InvoiceCustomFields', invoicecustomfieldsSchema);
