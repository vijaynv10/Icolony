const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('_middleware/validate-request');
const authorize = require('_middleware/authorize')
const Role = require('_helpers/role');
const employeeService = require('./employee.service');
var _ = require('underscore');

// routes
router.post('/sign-in', signInSchema, signIn);
router.post('/username-verify/:username', usernameVerify);
router.post('/refresh-token/',refreshTokenSchema, refreshToken);
router.post('/revoke-token', authorize(), revokeTokenSchema, revokeToken);
router.post('/custom-prices-update',authorize(), customPricesSchema, customPrices);
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

// username verification 
function usernameVerify(req, res, next) {
    var username = req.params.username;
    employeeService.usernameVerify(username)
        .then(({usernamestatus}) => {res.json(usernamestatus)})
        .catch(next);
}

function signInSchema(req, res, next) {
    const schema = Joi.object({
        username: Joi.string().required(),
        password: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

// Sign in
function signIn(req, res, next) {
    const { username, password } = req.body;
    const ipAddress = req.ip;
    employeeService.signIn({ username, password, ipAddress })
        .then((account) => {
            res.json(account);
        })
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
    employeeService.refreshToken({id, token, ipAddress })
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

    employeeService.revokeToken({ token, ipAddress })
        .then(() => res.json({ message: 'Token revoked' }))
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
    employeeService.forgotPassword(req.body, req.get('origin'))
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
    employeeService.validateResetToken(req.body)
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
    employeeService.resetPassword(req.body)
        .then(() => res.json({ message: 'Password reset successful, you can now login' }))
        .catch(next);
}

// get account by id 
function getById(req, res, next) {
    // users can get their own account and admins can get any account
    if (req.params.id !== req.user.id) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    employeeService.getById(req.params.id)
        .then(account => account ? res.json(account) : res.sendStatus(404))
        .catch(next);
}


// delete 
function _delete(req, res, next) {
    // users can delete their own account and admins can delete any account
    if (req.params.id !== req.user.id) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    employeeService.delete(req.params.id)
        .then(() => res.json({ message: 'Account deleted successfully' }))
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
function customPrices(req, res, next) {
    const {merchantid,customerid,productprices} = req.body;
    const ipAddress = req.ip;
    if (merchantid !== req.user.id) {
        return res.status(401).json({ message: 'Unauthorized to add custom prices' });
    }

    employeeService.customPrices({merchantid,customerid,productprices, ipAddress })
        .then(() => res.json({ message: 'Custom Prices Updated Successfully' }))
        .catch(next);
}
