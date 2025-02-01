const { text } = require('body-parser');
const { Timestamp } = require('bson');
const { number, string } = require('joi');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const routeSchema = new Schema({
    shops:{type:[String]},
    ownerid: { type: String, required: true },
    routecreated :Date,
    routeupdated: Date,
    routeupdatedby:{type: String},
});

routeSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
    }
});

module.exports = mongoose.model('Route', routeSchema);
