const { ObjectID } = require('bson');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const customproductpricesSchema = new mongoose.Schema({
    productid:{type: String, required: true},
    variantid:{type: String, required: true},
    wholesaleprice:{type: Number, required: true},
    discount:{type: Number, required: true},
});

const custompricesSchema = new Schema({
    merchantid: { type: String, required: true },
    customerid: { type: String},
    productprices:{type:[customproductpricesSchema]}
});

custompricesSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
    }
});

module.exports = mongoose.model('CustomPrice', custompricesSchema);