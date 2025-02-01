const { text } = require('body-parser');
const { Timestamp } = require('bson');
const { number } = require('joi');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderstockschema = new Schema({
    batchnumber: { type: String, required: true },
    quantity: { type: Number },
    expirydate: Date, 
});

const orderitemschema = new Schema({
    productid: { type: String, required: true},
    variantid: { type: String, required: true},
    quantity: { type: Number },
    returnquantity: { type:Number },
    stockdelivered: {type:[orderstockschema]},
    stockreturned: {type:[orderstockschema]}
});

const orderSchema = new Schema({
    customer: {type: String, required: true },
    merchant:{type: String, required: true },
    orderitems: { type:[orderitemschema]},
    orderstatus:{type: String, required: true },
    amount: { type: Number, required: true },
    cgst:{ type: Number },
    sgst:{ type: Number },
    igst:{ type: Number },
    creditsused:{ type: Number , required: true},
    amountpaid: {type: Number, required: true },
    amountrefunded: {type: Number, required: true },
    paymentmethod: {type: String},
    paymentdate: Date,
    orderconfirmationcode:{type: String, required: true},
    placeddate:Date,
    scheduleddate:Date,
    returnvaliditydate:Date,
    delivereddate:Date,
    returnrequesteddate:Date,
    returnrespondeddate:Date,
    cancellationrequesteddate:Date,
    cancellationrespondeddate:Date,
    cancellationstatus:{ type: Number },
    returnstatus:{ type: Number },
    ordercreatedby :{type: String, required: true },
    orderdeliveredby :{type: String},
    orderreturnedby :{type: String},
});



orderSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
    }
});

module.exports = mongoose.model('Order', orderSchema);
