const { text } = require('body-parser');
const { Timestamp } = require('bson');
const { number } = require('joi');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const invoicespaymentSchema = new Schema({
    invoiceid: { type: String, required: true},
    amountpaid: { type: Number, required: true},
});

const paymentSchema = new Schema({
    customer:{ type:String, required: true },
    merchant:{ type:String, required: true },
    invoicesincluded: { type:[invoicespaymentSchema]},
    paymentmethod: { type:String, required: true },
    amountpaid:{ type: Number, required: true },
    paymentdate:Date
});

paymentSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
    }
});

module.exports = mongoose.model('Payment', paymentSchema);
