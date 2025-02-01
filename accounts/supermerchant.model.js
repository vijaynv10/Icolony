const { text } = require('body-parser');
const { Timestamp } = require('bson');
const { number, string } = require('joi');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const superMerchantSchema = new Schema({
    shoplimit:{type: Number, required: true},
    shopsincluded:{type: [String], required: true},
    username: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    password: {type: String, required: true },
    accountcreated :Date,
    accountupdated: Date,
    validity:Date
});

superMerchantSchema.virtual('isVerified').get(function () {
    return !!(this.verified || this.passwordReset);
});

superMerchantSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
    }
});

module.exports = mongoose.model('SuperMerchant', superMerchantSchema);
