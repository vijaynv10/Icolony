const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('_middleware/validate-request');
const authorize = require('_middleware/authorize')
const Role = require('_helpers/role');
const accountService = require('./account.service');
var _ = require('underscore');
const multer = require('multer');
const path = require('path');
const db = require('_helpers/db');

const ShopImageUpload = multer({
    storage: new multer.diskStorage({
        destination: 'ShopImages', // Destination to store image 
        filename: (req, file, cb) => {
            cb(null, req.body.name + path.extname(file.originalname))
        }
    }),
    limits: {
        fileSize: 10000000   // 10000000 Bytes = 10 MB
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(png|jpg)$/)) {     // upload only png and jpg format
            return cb(new Error('Please upload a Image'))
        }
        cb(undefined, true)
    }
})  

// routes
router.post('/super-merchant-sign-up', superMerchantSignUpSchema, superMerchantSignUp);
router.post('/super-merchant-sign-in', superMerchantSignInSchema, superMerchantSignIn);
router.post('/sign-up', mailSignUpSchema, mailSignUp);
router.post('/update-personaldata', authorize(),updatePersonalDetailsSchema, updatePersonalDetails);
router.post('/sign-in', mailSignInSchema, mailSignIn);
router.post('/username-verify/:username', usernameVerify);
// For Single image upload
router.post('/upload-shop-image',authorize(),ShopImageUpload.single('image'), (req, res) => {
    res.send(req.file)
}, (error, req, res, next) => {
    res.status(400).send({ error: error.message })
})
router.post('/update-address', authorize(),updateAddressSchema, updateAddress);
router.post('/update-licenses', authorize(),updateLicensesSchema, updateLicenses);
router.post('/refresh-token/',refreshTokenSchema, refreshToken);
router.post('/revoke-token', authorize(), revokeTokenSchema, revokeToken);
router.post('/subscribe-seller',authorize(), subscribeSellerSchema, subscribeSeller);
router.post('/update-seller-subscription',authorize(), updateSellerSubscriptionSchema, updateSellerSubscription);
router.post('/check-custom-price-validity/:id', authorize(), checkCustomPriceValidity);
router.post('/check-employees-validity/:id', authorize(), checkEmployeesValidity);
router.post('/update-seller-subscription-details',authorize(), updateSellerSubscriptionDetailsSchema, updateSellerSubscriptionDetails);
router.post('/custom-prices-update',authorize(), customPricesSchema, customPrices);
router.post('/invoice-custom-fields-update',authorize(), customInvoiceFieldsSchema, customInvoiceFields);
router.get('/verify-email/:token', verifyEmail); 
router.post('/forgot-password', forgotPasswordSchema, forgotPassword);
router.post('/validate-reset-token', validateResetTokenSchema, validateResetToken);
router.post('/reset-password', resetPasswordSchema, resetPassword);
router.get('/:id', authorize(), getById);
router.delete('/:id', authorize(), _delete);

module.exports = router;

/*
// authorize function --------------------------
function authorizecall(req, res, next) {
    authorize()
    .then(next)
    .catch(() => res.json({ message: 'Unauthorized' })); 
}
*/

async function supermerchantcheck(supermerchantid,merchantid)
{
    
    const supermerchant = await db.SuperMerchant.findById(supermerchantid);
    if(!supermerchant)
        return false;

    let permitted = false;
    for(let i=0;i<supermerchant.shopsincluded.length;i++)
    {
        if(supermerchant.shopsincluded[i] == merchantid)
            permitted = true;
    }    
    return permitted;   
}


function superMerchantSignUpSchema(req, res, next) {
    const schema = Joi.object({
        name: Joi.string().required(),
        shoplimit: Joi.number().required(),
        shopsincluded: Joi.array().items(Joi.string()),
        username: Joi.string().required(),
        password: Joi.string().required(),
        durationinmonths: Joi.number().required()
    });
    validateRequest(req, next, schema);
}

// Super Merchant Sign up
function superMerchantSignUp(req, res, next) {
    const {name,shoplimit,shopsincluded,username, password,durationinmonths } = req.body;
    const ipAddress = req.ip;
    accountService.superMerchantSignUp({name,shoplimit,shopsincluded,username, password,durationinmonths, ipAddress })
        .then((account) => {
            res.json(account);
        })
        .catch(next);
}

function superMerchantSignInSchema(req, res, next) {
    const schema = Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required(),
    });
    validateRequest(req, next, schema);
}

// Super Merchant Sign in
function superMerchantSignIn(req, res, next) {
    const {username, password } = req.body;
    const ipAddress = req.ip;
    accountService.superMerchantSignIn({username, password, ipAddress })
        .then((account) => {
            res.json(account);
        })
        .catch(next);
}

function mailSignUpSchema(req, res, next) {
    const schema = Joi.object({
        name: Joi.string().required(),
        shopname: Joi.string().required(),
        shoptype: Joi.string().required(),
        username: Joi.string().required(),
        password: Joi.string().required(),
        mobilenumber: Joi.number().required(),
        email: Joi.string().email().required(),
    });
    validateRequest(req, next, schema);
}

// Sign up
function mailSignUp(req, res, next) {
    const {name,shopname,shoptype,username,password,mobilenumber,email } = req.body;
    const ipAddress = req.ip;
    accountService.mailSignUp({name,shopname,shoptype,username, password,mobilenumber,email, ipAddress })
        .then(({ refreshToken, ...account }) => {
            const accountMerge = {refreshToken , ...account};
            res.json(accountMerge);
        })
        .catch(next);
}

// username verification 
function usernameVerify(req, res, next) {
    var username = req.params.username;
    accountService.usernameVerify(username)
        .then(({usernamestatus}) => {res.json(usernamestatus)})
        .catch(next);
}

// update personal details
function updatePersonalDetailsSchema(req, res, next) {
    const schema = Joi.object({
        id: Joi.string().required(),
        name: Joi.string(),
        shopname: Joi.string(),
        shoptype: Joi.string(),
        username: Joi.string()
    });
    validateRequest(req, next, schema);
}

// update personal details of user
async function updatePersonalDetails(req, res, next) {
    const {id, name, shopname,shoptype,username } = req.body;
    const ipAddress = req.ip;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,id);
    if(req.user.id!= id && !ifsupermerchant)
        return res.status(401).json({ message: 'Unauthorized to make the change' });
    accountService.updatePersonalDetails({id, name, shopname,shoptype,username, ipAddress })
    .then(() => res.json({ message: 'Personal details have been updated' }))
    .catch(next);
}

function mailSignInSchema(req, res, next) {
    const schema = Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

// Sign in
function mailSignIn(req, res, next) {
    const { username, password } = req.body;
    const ipAddress = req.ip;
    accountService.mailSignIn({ username, password, ipAddress })
        .then(({ refreshToken, ...account }) => {
            const accountMerge = {refreshToken , ...account};
            res.json(accountMerge);
        })
        .catch(next);
}

function updateAddressSchema(req, res, next) {
    const schema = Joi.object({
        id: Joi.string().required(),
        type: Joi.string().required(),
        address: Joi.object
        ({
            floor: Joi.string().required(),
            plotnumber: Joi.string().required(),
            street: Joi.string().required(),
            area: Joi.string().required(),
            district: Joi.string().required(),
            city: Joi.string().required(),
            state: Joi.string().required(),
            pin: Joi.number().required(),
            latitude: Joi.number(),
            longitude: Joi.number()
        })
    });
    validateRequest(req, next, schema);
}

// Update Address
async function updateAddress(req, res, next) {
    const {id , type, address } = req.body;
    const ipAddress = req.ip;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,id);
    if(req.user.id!= id && !ifsupermerchant)
        return res.status(401).json({ message: 'Unauthorized to make the change' });
    accountService.updateAddress({id, type, address, ipAddress })
    .then(() => res.json({ message: 'Address has been updated' }))
    .catch(next);
}

function updateLicensesSchema(req, res, next) {
    const schema = Joi.object({
        id: Joi.string().required(),
        gstin: Joi.string(),
        pan: Joi.string(),
        fssai: Joi.string(),
        customlicenses: Joi.array()
        .items({
            licensename: Joi.string(),
            licensenumber: Joi.string()
        })
    });
    validateRequest(req, next, schema);
}

// Update Licenses
async function updateLicenses(req, res, next) {
    const {id , gstin,pan,fssai, customlicenses } = req.body;
    const ipAddress = req.ip;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,id);
    if(req.user.id!= id && !ifsupermerchant)
        return res.status(401).json({ message: 'Unauthorized to make the change' });
    accountService.updateLicenses({id, gstin,pan,fssai, customlicenses, ipAddress })
    .then(() => res.json({ message: 'Licenses have been updated' }))
    .catch(next);
}

function refreshTokenSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required(),
        id: Joi.string().required(),
    });
    validateRequest(req, next, schema);
}

// refresh token
function refreshToken(req, res, next) {
    const token = req.body.token;
    const id = req.body.id;
    const ipAddress = req.ip;
    accountService.refreshToken({id, token, ipAddress })
        .then(({ refreshToken, ...account }) => {
            const accountMerge = {refreshToken , ...account};
            res.json(accountMerge);
        })
        .catch(next);
}

function revokeTokenSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().empty('')
    });
    validateRequest(req, next, schema);
}

// revoke token 
function revokeToken(req, res, next) {
    // accept token from request body or cookie
    const token = req.body.token;
    const ipAddress = req.ip;

    if (!token) return res.status(400).json({ message: 'Token is required' });

    accountService.revokeToken({ token, ipAddress })
        .then(() => res.json({ message: 'Token revoked' }))
        .catch(next);
}

function verifyEmailSchema(req, res, next) {
    validateRequest(req, next, schema);
}

// email verification 
function verifyEmail(req, res, next) {
    var verificationtoken = req.params.token;
    accountService.verifyEmail(verificationtoken)
        .then(() => res.json({ message: 'Verification successful, you can now login' }))
        .catch(next);
}

function forgotPasswordSchema(req, res, next) {
    const schema = Joi.object({
        email: Joi.string().email().required()
    });
    validateRequest(req, next, schema);
}
// forgot password 
function forgotPassword(req, res, next) {
    accountService.forgotPassword(req.body, req.get('origin'))
        .then(() => res.json({ message: 'Please check your email for password reset instructions' }))
        .catch(next);
}

function validateResetTokenSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

// validate reset token
function validateResetToken(req, res, next) {
    accountService.validateResetToken(req.body)
        .then(() => res.json({ message: 'Token is valid' }))
        .catch(next);
}

function resetPasswordSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    });
    validateRequest(req, next, schema);
}

// reset password 
function resetPassword(req, res, next) {
    accountService.resetPassword(req.body)
        .then(() => res.json({ message: 'Password reset successful, you can now login' }))
        .catch(next);
}

// get account by id 
function getById(req, res, next) {
    // users can get their own account and admins can get any account
    if (req.params.id !== req.user.id) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    accountService.getById(req.params.id)
        .then(account => account ? res.json(account) : res.sendStatus(404))
        .catch(next);
}

// delete 
function _delete(req, res, next) {
    // users can delete their own account and admins can delete any account
    if (req.params.id !== req.user.id) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    accountService.delete(req.params.id)
        .then(() => res.json({ message: 'Account deleted successfully' }))
        .catch(next);
}

function subscribeSellerSchema(req, res, next) {
    const schema = Joi.object({
        subscriptionuser: Joi.string().required(),
        acceptordertill: Joi.string().required(),
        productlimit: Joi.number().required(),
        customprices: Joi.boolean().required(),
        delivery: Joi.boolean().required(),
        deliverydurationinmonths: Joi.number().required(),
        custompricesdurationinmonths: Joi.number().required(),
        employeelimit: Joi.number().required(),
        employeeaccounts:Joi.array().items({
            employeeid: Joi.string().required(),
            employeename: Joi.string().required(),
            username: Joi.string().required(),
            password: Joi.string().required(),
            permissions:Joi.array().items({
                permissionname: Joi.string().required(),
                view: Joi.boolean().required(),
                edit: Joi.boolean().required(),
            }),
            durationinmonths: Joi.number().required(),
        }),
        deliveryaccounts:Joi.array().items({
            employeeid: Joi.string().required(),
            employeename: Joi.string().required(),
            username: Joi.string().required(),
            password: Joi.string().required(),
            routeassigned:Joi.string().required(),
            durationinmonths: Joi.number().required(),
        }),
        defaultcreditlimit:Joi.number().required(),
        defaultreturnvalidity: Joi.string().required(),
        orderprocessingtime: Joi.number().required(),
        invoiceprefixstring:Joi.string().required(),
        lastinvoicenumber:Joi.number().required(),
        invoiceresetdate:Joi.string().required(),
        invoiceconditions: Joi.string().required(),
        fooddeclaration: Joi.string().required(),
        categoriessold: Joi.array().items(Joi.string()),
        onlinepaymentsallowed: Joi.bool().required(),
        deliverablepincodes: Joi.array().items(Joi.string()),
        durationinmonths: Joi.number().required(),
    });
    validateRequest(req, next, schema);
}

// Subscribe seller
async function subscribeSeller(req, res, next) {
    const {subscriptionuser,acceptordertill,productlimit,customprices,delivery,deliverydurationinmonths,custompricesdurationinmonths, employeelimit,employeeaccounts,deliveryaccounts,defaultcreditlimit,defaultreturnvalidity,orderprocessingtime,invoiceprefixstring,lastinvoicenumber,invoiceresetdate,invoiceconditions,fooddeclaration,categoriessold,onlinepaymentsallowed,deliverablepincodes,durationinmonths } = req.body;
    const ipAddress = req.ip;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,subscriptionuser);
    if(req.user.id!= subscriptionuser && !ifsupermerchant)
        return res.status(401).json({ message: 'Unauthorized to make the change' });

    accountService.subscribeSeller({subscriptionuser,acceptordertill,productlimit,customprices,delivery,deliverydurationinmonths,custompricesdurationinmonths, employeelimit,employeeaccounts,deliveryaccounts,defaultcreditlimit,defaultreturnvalidity,orderprocessingtime,invoiceprefixstring,lastinvoicenumber,invoiceresetdate,invoiceconditions,fooddeclaration,categoriessold,onlinepaymentsallowed,deliverablepincodes,durationinmonths, ipAddress })
        .then((subscription) => {
            res.json(subscription);
        })
        .catch(next);
}


function updateSellerSubscriptionSchema(req, res, next) {
    const schema = Joi.object({
        subscriptionuser: Joi.string().required(),
        productlimit: Joi.number().required(),
        employeelimit: Joi.number().required(),
        customprices: Joi.boolean().required(),
        delivery: Joi.boolean().required(),
        deliverydurationinmonths: Joi.number().required(),
        custompricesdurationinmonths: Joi.number().required(),
        durationinmonths: Joi.number().required(),
        employeeaccounts:Joi.array().items({
            employeeid: Joi.string().required(),
            employeename: Joi.string().required(),
            username: Joi.string().required(),
            password: Joi.string().required(),
            permissions:Joi.array().items({
                permissionname: Joi.string().required(),
                view: Joi.boolean().required(),
                edit: Joi.boolean().required(),
            }),
            durationinmonths: Joi.number().required(),
        }),
        deliveryaccounts:Joi.array().items({
            employeeid: Joi.string().required(),
            employeename: Joi.string().required(),
            username: Joi.string().required(),
            password: Joi.string().required(),
            routeassigned:Joi.string().required(),
            durationinmonths: Joi.number().required(),
        }),
    });
    validateRequest(req, next, schema);
}

// update money subscription details
async function updateSellerSubscription(req, res, next) {
    const {subscriptionuser,productlimit,customprices,delivery,deliverydurationinmonths,custompricesdurationinmonths, employeelimit,durationinmonths,employeeaccounts,deliveryaccounts } = req.body;
    const ipAddress = req.ip;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,subscriptionuser);
    if(req.user.id!= subscriptionuser && !ifsupermerchant)
        return res.status(401).json({ message: 'Unauthorized to make the change' });

    accountService.updateSellerSubscription({subscriptionuser,productlimit,customprices,delivery,deliverydurationinmonths, employeelimit,custompricesdurationinmonths,durationinmonths,employeeaccounts,deliveryaccounts, ipAddress })
        .then(() => res.json({ message: 'Subscription updated successfully' }))
        .catch(next);
}

function updateSellerSubscriptionDetailsSchema(req, res, next) {
    const schema = Joi.object({
        subscriptionuser:Joi.string().required(),
        acceptordertill: Joi.string(),
        defaultcreditlimit: Joi.number(),
        defaultreturnvalidity: Joi.string(),
        orderprocessingtime: Joi.number(),
        invoiceprefixstring:Joi.string(),
        lastinvoicenumber:Joi.number(),
        invoiceresetdate:Joi.string(),
        invoiceconditions: Joi.string(),
        fooddeclaration: Joi.string(),
        categoriessold: Joi.array().items(Joi.string()),
        onlinepaymentsallowed: Joi.bool().required(),
        deliverablepincodes: Joi.array().items(Joi.string()),
    });
    validateRequest(req, next, schema);
}

// Update seller subscription details
async function updateSellerSubscriptionDetails(req, res, next) {
    const {subscriptionuser,acceptordertill,defaultcreditlimit,defaultreturnvalidity,orderprocessingtime,invoiceprefixstring,lastinvoicenumber,invoiceresetdate,invoiceconditions,fooddeclaration,categoriessold,onlinepaymentsallowed,deliverablepincodes } = req.body;
    const ipAddress = req.ip;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,subscriptionuser);
    if(req.user.id!= subscriptionuser && !ifsupermerchant)
        return res.status(401).json({ message: 'Unauthorized to make the change' });

    accountService.updateSellerSubscriptionDetails({subscriptionuser,acceptordertill,defaultcreditlimit,defaultreturnvalidity,orderprocessingtime,invoiceprefixstring,lastinvoicenumber,invoiceresetdate,invoiceconditions,fooddeclaration,categoriessold,onlinepaymentsallowed,deliverablepincodes, ipAddress })
        .then(() => res.json({ message: 'Subscription Details updated successfully' }))
        .catch(next);
}

function customPricesSchema(req, res, next) {
    const schema = Joi.object({
        merchantid: Joi.string().required(),
        customerid: Joi.string().required(),
        productprices: Joi.array()
        .items({
            productid: Joi.string().required(),
            variantid: Joi.string().required(),
            wholesaleprice: Joi.number().required(),
            discount: Joi.number().required()
        })
    });
    validateRequest(req, next, schema);
}

// update Custom Prices from a merchant for a customer
async function customPrices(req, res, next) {
    const {merchantid,customerid,productprices} = req.body;
    const ipAddress = req.ip;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,merchantid);
    if(req.user.id!= merchantid && !ifsupermerchant)
        return res.status(401).json({ message: 'Unauthorized to make the change' });
    
    accountService.customPrices({merchantid,customerid,productprices, ipAddress })
        .then(() => res.json({ message: 'Custom Prices Updated Successfully' }))
        .catch(next);
}

function customInvoiceFieldsSchema(req, res, next) {
    const schema = Joi.object({
        merchantid: Joi.string().required(),
        customfields: Joi.array()
        .items({
            fieldname: Joi.string().required(),
            fieldvalue: Joi.string().required(),
        })
    });
    validateRequest(req, next, schema);
}

// update custom invoice fields for each merchant 
async function customInvoiceFields(req, res, next) {
    const {merchantid,customfields} = req.body;
    const ipAddress = req.ip;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,merchantid);
    if(req.user.id!= merchantid && !ifsupermerchant)
        return res.status(401).json({ message: 'Unauthorized to make the change' });

    accountService.customInvoiceFields({merchantid,customfields, ipAddress })
        .then(() => res.json({ message: 'Invoice Custom Fields Updated Successfully' }))
        .catch(next);
}

// Check Custom Price Validity
function checkCustomPriceValidity(req, res, next) {
    const merchantid = req.params.id;
    const ipAddress = req.ip;
    if (merchantid !== req.user.id) {
        return res.status(401).json({ message: 'Unauthorized to check validity' });
    }

    accountService.checkCustomPriceValidity({merchantid, ipAddress })
    .then((validitydetails) => {res.json(validitydetails)})
    .catch(next);
}

// Check Employees Validity
async function checkEmployeesValidity(req, res, next) {
    const merchantid = req.params.id;
    const ipAddress = req.ip;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,merchantid);
    if(req.user.id!= merchantid && !ifsupermerchant)
        return res.status(401).json({ message: 'Unauthorized to make the change' });

    accountService.checkEmployeesValidity({merchantid, ipAddress })
    .then((employeesvalidity) => {res.json(employeesvalidity)})
    .catch(next);
}

