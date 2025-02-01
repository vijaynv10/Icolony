const { text } = require('body-parser');
const { number } = require('joi');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const productlistingrequestsschema = new Schema({
    productid: { type: String, required: true },
    listedproductid: { type: String },
    approvalstatus: { type: Number, required: true }, 
});

const approvedmerchantschema = new Schema({
    merchantid: { type: String, required: true},
    approvalstatus: { type: Number, required: true},
    customprices: { type: Boolean },
    creditlimit: { type:Number },
    outstanding: { type:Number },
    productlistingrequests: {type:[productlistingrequestsschema]}
});

const addressschema = new Schema({
    floor: { type: String, required: true },
    plotnumber: { type: String, required: true },
    street: { type: String, required: true },
    area: { type: String, required: true },
    district: { type:String , required: true},
    city: { type:String , required: true},
    state: { type:String , required: true},
    pin: { type: Number, required: true },
    latlong: { type:String},
});

const customlicenseschema = new Schema({
    licensename: { type: String, required: true },
    licensenumber: { type: String, required: true } 
});

const userSchema = new Schema({
    userid: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    shopname: {type:String, required: true },
    shoptype: { type: String, required: true },
    username: { type: String, unique: true, required: true },
    password: {type: String, required: true },
    mobilenumber:{type: Number, required: true},
    email: {type: String, required: true},
    approvedmerchants:{type:[approvedmerchantschema]},
    verificationtoken:{type: String},
    emvstatus:{type: Number},
    mnvstatus: {type: Number},
    rpstatus:{type: Number},
    subscriptions :{type: [String]},
    billingaddress:{type:addressschema},
    shippingaddress:{type:addressschema},
    gstin: {type: String },
    pan: { type: String},
    fssai: { type: String},
    customlicenses:{type:[customlicenseschema]},
    resetToken: {
        token: String,
        expires: Date
    },
    accountcreated :Date,
    accountverified :Boolean,
    lastpasswordchanged : Date,
    accountupdated: Date,
    lastlogintime:Date,
    lastloginip:{type:String}
});

userSchema.virtual('isVerified').get(function () {
    return !!(this.verified || this.passwordReset);
});

userSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
        delete ret.passwordHash;
    }
});


module.exports = mongoose.model('Account', userSchema);
