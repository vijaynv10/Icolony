const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('_middleware/validate-request');
const authorize = require('_middleware/authorize')
const Role = require('_helpers/role');
const db = require('_helpers/db');
const deliveryService = require('./delivery.service');
var _ = require('underscore');

// routes
router.post('/sign-in', signInSchema, signIn);
router.post('/username-verify/:username', usernameVerify);
router.post('/refresh-token/',refreshTokenSchema, refreshToken);
router.post('/revoke-token', authorize(), revokeTokenSchema, revokeToken);
router.post('/forgot-password', forgotPasswordSchema, forgotPassword);
router.post('/validate-reset-token', validateResetTokenSchema, validateResetToken);
router.post('/reset-password', resetPasswordSchema, resetPassword);
router.get('/:id', authorize(), getById);
router.delete('/:id', authorize(), _delete);
router.post('/add-route',authorize(), addRouteSchema, addRoute);
router.post('/edit-route/:id',authorize(), editRouteSchema, editRoute);
router.get('/get-route/:id',authorize(), getRoute);
module.exports = router;

/*
// authorize function --------------------------
function authorizecall(req, res, next) {
    authorize()
    .then(next)
    .catch(() => res.json({ message: 'Unauthorized' })); 
}
*/

async function deliverypersoncheck(routeid,deliverypersonid)
{ 
    const deliveryperson = await db.DeliveryPerson.findById(deliverypersonid);
    if(!deliveryperson)
        return false;

    if(deliveryperson.routeassigned == routeid)
        return true;
    else
        return false; 
}
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

async function employeecheck(employeeid,owner,feature,type)
{
    const employee = await db.Employee.findById(employeeid);
    if(!employee)
        return false;
    if(employee.owner ===owner)
    {      
        let permitted = false;
        for(let i=0;i<employee.permissions.length;i++)
        {
            if(employee.permissions[i].permissionname == feature)
            {
                if(type == "edit")
                {
                    if(employee.permissions[i].edit)
                        permitted = true;
                }
                else if(type == "view")
                {
                    if(employee.permissions[i].view)
                        permitted = true;
                }
            }
        }
        if(permitted)
            return true;
        else
            return false;
    }
    else
        return false;
    
}

function usernameVerify(req, res, next) {
    var username = req.params.username;
    deliveryService.usernameVerify(username)
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
    deliveryService.signIn({ username, password, ipAddress })
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
    deliveryService.refreshToken({id, token, ipAddress })
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

    deliveryService.revokeToken({ token, ipAddress })
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
    deliveryService.forgotPassword(req.body, req.get('origin'))
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
    deliveryService.validateResetToken(req.body)
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
    deliveryService.resetPassword(req.body)
        .then(() => res.json({ message: 'Password reset successful, you can now login' }))
        .catch(next);
}

// get account by id 
function getById(req, res, next) {
    // users can get their own account and admins can get any account
    if (req.params.id !== req.user.id) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    deliveryService.getById(req.params.id)
        .then(account => account ? res.json(account) : res.sendStatus(404))
        .catch(next);
}


// delete 
function _delete(req, res, next) {
    // users can delete their own account and admins can delete any account
    if (req.params.id !== req.user.id) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    deliveryService.delete(req.params.id)
        .then(() => res.json({ message: 'Account deleted successfully' }))
        .catch(next);
}

function addRouteSchema(req, res, next) {
    const schema = Joi.object({
        shops: Joi.array().items(Joi.string()).required(),
        ownerid: Joi.string().required(),
        routeupdatedby: Joi.string().required(),
    });
    validateRequest(req, next, schema);
}

// Customer Request for user account
async function addRoute(req, res, next) {
    const {shops,ownerid,routeupdatedby } = req.body;
    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,ownerid);
    const ifemployeeandhaspermission = await employeecheck(employeeid,ownerid,"Delivery","edit");
    if (ownerid !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to add route' });
    }
    deliveryService.addRoute({shops,ownerid,routeupdatedby, ipAddress })
    .then(() => res.json({ message: 'Route added' }))
    .catch(next);
}

function editRouteSchema(req, res, next) {
    const schema = Joi.object({
        shops: Joi.array().items(Joi.string()).required(),
        ownerid: Joi.string().required(),
        routeupdatedby: Joi.string().required(),
    });
    validateRequest(req, next, schema);
}

// Editing added route
async function editRoute(req, res, next) {
    const {shops,ownerid,routeupdatedby } = req.body;
    const ipAddress = req.ip;
    const routeid = req.params.id;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,ownerid);
    const ifemployeeandhaspermission = await employeecheck(employeeid,ownerid,"Delivery","edit");
    if (ownerid !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to edit route' });
    }
    deliveryService.editRoute({shops,ownerid,routeid,routeupdatedby, ipAddress })
    .then(() => res.json({ message: 'Route updated' }))
    .catch(next);
}

// Get route
async function getRoute(req, res, next) {
    const routeid = req.params.id;
    const ipAddress = req.ip;
    const route = await db.Route.findById(routeid);
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const deliverypersonid = req.user.id;
    const ifrouteassigned = await deliverypersoncheck(routeid,deliverypersonid);
    const ifsupermerchant = await supermerchantcheck(supermerchantid,route.ownerid);
    const ifemployeeandhaspermission = await employeecheck(employeeid,route.ownerid,"Delivery","View");
    if (route.ownerid !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant && !ifrouteassigned) {
        return res.status(401).json({ message: 'Unauthorized to get route' });
    }
    deliveryService.getRoute({ routeid, ipAddress })
    .then(( route ) => {
        res.json(route);
    })
    .catch(next);
} 