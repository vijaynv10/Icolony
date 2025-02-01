const { ObjectID } = require('bson');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const stockdetailsSchema = new Schema({
    batchnumber: { type: String, required: true },
    manufactureddate: Date,
    expirydate:Date,
    updateddate:Date,
    stockleft: {type:Number}
});

const productdetailsSchema = new mongoose.Schema({
    name: {type: String},
    unitvalue: {type: Number},
    unit:{type: String},
    wholesaleprice: {type: Number},
    retialprice: {type: Number},
    discount:{type: Number},
    cgst: {type: Number},
    sgst: {type: Number},
    igst:{type: Number},
    salesnumber: {type: Number},
    returnnumber: {type: Number},
    stock:{type:[stockdetailsSchema]},
    available: Boolean,
    size:{type: Number},
    shelflife:{type: Number}, //Number in days 
    dimensions: {type: String},
    colour: {type: String},
    minimumorder:{type: Number}
});

const productSchema = new Schema({
    productname: { type: String, required: true },
    category: { type: String},
    subcategory: {type:String},
    productdetails:{type:[productdetailsSchema]},
    hsncode: { type: String},
    owner: { type: String},
    addedby: {type: String},
    listedby: {type: String},
    createdDTS:Date,
    lastupdatedDTS: Date,
    lastupdatedIP:{type:String},
    sponsored:Boolean,
    validity:Date
});

productSchema.virtual('isVerified').get(function () {
    return !!(this.verified || this.passwordReset);
});

productSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
        delete ret.passwordHash;
    }
});

module.exports = mongoose.model('Product', productSchema);