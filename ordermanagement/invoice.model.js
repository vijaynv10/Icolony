const { text } = require('body-parser');
const { Timestamp } = require('bson');
const { number } = require('joi');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const customfieldSchema = new Schema({
    fieldname: { type: String, required: true},
    fieldvalue: { type: Number, required: true},
});

const invoiceSchema = new Schema({
    invoicenumber: { type:String, required: true },
    ifinvoice: Boolean,
    customer:{ type:String, required: true },
    merchant:{ type:String, required: true },
    orderid: { type:String, required: true},
    paymentdone: Boolean,
    amount:{ type: Number, required: true },
    outstanding:{ type: Number, required: true },
    customfields: { type:[customfieldSchema]},
    createddate:Date
});

invoiceSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
    }
});

module.exports = mongoose.model('Invoice', invoiceSchema);
