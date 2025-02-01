const { text } = require('body-parser');
const { Timestamp } = require('bson');
const { number, string } = require('joi');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const productlistingrequestsschema = new Schema({
    productid: { type: String, required: true },
    listedproductid: { type: String },
    approvalstatus: { type: Number, required: true }, 
});

const approvedcustomerschema = new Schema({
    customerid: { type: String, required: true},
    approvalstatus: { type: Number, required: true},
    customprices: { type: Boolean },
    creditlimit: { type:Number },
    outstanding: { type:Number },
    productlistingrequests: {type:[productlistingrequestsschema]}
});

const subscriptionSchema = new Schema({
    subscriptionuser: { type: String, unique: true, required: true },
    supermerchantid: { type: String},
    approvedcustomers:{type:[approvedcustomerschema]},
    acceptordertill: { type: String, required: true },
    productlimit: { type: String, required: true },
    customprices: Boolean,
    delivery:Boolean,
    deliveryvalidity:Date,
    custompricesvalidity: Date,
    employeelimit: {type: String, required: true },
    employeeaccounts:{type:[String]},
    deliveryaccounts:{type:[String]},
    defaultcreditlimit:{type: Number, required: true},
    defaultreturnvalidity: {type: Number, required: true}, //Number of days
    orderprocessingtime:{type: Number, required: true},
    invoiceprefixstring:{type: String, required: true},
    lastinvoicenumber:{type: Number, required: true},
    invoiceresetdate:{type: String, required: true},
    invoiceconditions:{type: String, required: true},
    fooddeclaration: {type: String, required: true},
    categoriessold:{type: [String]},
    onlinepaymentsallowed :{type: Boolean},
    deliverablepincodes:{type: [Number]},
    accountcreated :Date,
    accountupdated: Date,
    validity:Date
});

subscriptionSchema.virtual('isVerified').get(function () {
    return !!(this.verified || this.passwordReset);
});

subscriptionSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
        delete ret.passwordHash;
    }
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
