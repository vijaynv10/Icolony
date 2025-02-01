const { text } = require('body-parser');
const { Timestamp } = require('bson');
const { number, string } = require('joi');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const permissionSchema = new Schema({
    permissionname: { type: String, required: true },
    view: Boolean,
    edit: Boolean, 
});

const employeeSchema = new Schema({
    owner:{ type: String, required: true },
    username: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    password: {type: String, required: true },
    permissions:{type:[permissionSchema]},
    accountcreated :Date,
    accountupdated: Date,
    validity:Date
});

employeeSchema.virtual('isVerified').get(function () {
    return !!(this.verified || this.passwordReset);
});

employeeSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        // remove these props when object is serialized
        delete ret._id;
    }
});

module.exports = mongoose.model('Employee', employeeSchema);
