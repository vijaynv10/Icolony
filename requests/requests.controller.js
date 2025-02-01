const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('_middleware/validate-request');
const authorize = require('_middleware/authorize')
const Role = require('_helpers/role');
const requestservice = require('./requests.service');
var _ = require('underscore');

// routes
router.post('/customer-request',authorize(), customerRequestSchema, customerRequest);
router.post('/approve-customer-request',authorize(), approveCustomerRequestSchema, approveCustomerRequest);
router.post('/product-listing-request',authorize(), productListingRequestSchema, productListingRequest);
router.post('/approve-product-listing-request',authorize(), approveProductListingRequestSchema, approveProductListingRequest);
router.get('/get-approved-customers/:id',authorize(), getApprovedCustomers);
router.get('/get-approved-merchants/:id',authorize(), getApprovedMerchants);
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

function customerRequestSchema(req, res, next) {
    const schema = Joi.object({
        merchantid: Joi.string().required(),
        customerid: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

// Customer Request for user account
async function customerRequest(req, res, next) {
    const {merchantid,customerid } = req.body;
    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,customerid);
    const ifemployeeandhaspermission = await employeecheck(employeeid,customerid,"Purchases","edit");
    if (customerid !== req.user.id && !ifemployeeandhaspermission && ! ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to make the change' });
    }
    requestservice.customerRequest({merchantid,customerid, ipAddress })
    .then(() => res.json({ message: 'Approval request sent . Your request for prices will be reviewed' }))
    .catch(next);
}

function approveCustomerRequestSchema(req, res, next) {
    const schema = Joi.object({
        merchantid: Joi.string().required(),
        customerid: Joi.string().required(),
        creditlimit: Joi.number().required(),
        customprices: Joi.boolean().required(),
        approvalstatus: Joi.number().required()
    });
    validateRequest(req, next, schema);
}

// Approve Customer Request
async function approveCustomerRequest(req, res, next) {

    const {merchantid,customerid,creditlimit,customprices,approvalstatus } = req.body;
    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,merchantid);
    const ifemployeeandhaspermission = await employeecheck(employeeid,merchantid,"Sales","edit");
    if (merchantid !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to make the change' });
    }
    requestservice.approveCustomerRequest({merchantid,customerid,creditlimit,customprices,approvalstatus, ipAddress })
    .then(() => res.json({ message: 'Approval request has been updated' }))
    .catch(next);
}

function productListingRequestSchema(req, res, next) {
    const schema = Joi.object({
        merchantid: Joi.string().required(),
        customerid: Joi.string().required(),
        productid: Joi.string().required(),
    });
    validateRequest(req, next, schema);
}

// Customer Request for user account
async function productListingRequest(req, res, next) {
    const {merchantid,customerid,productid} = req.body;
    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,customerid);
    const ifemployeeandhaspermission = await employeecheck(employeeid,customerid,"Sales","edit");
    if (customerid !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to make the change' });
    }
    requestservice.productListingRequest({merchantid,customerid,productid,ipAddress })
    .then(() => res.json({ message: 'Product listing request sent. Your request will be reviewed' }))
    .catch(next);
}

function approveProductListingRequestSchema(req, res, next) {
    const schema = Joi.object({
        merchantid: Joi.string().required(),
        customerid: Joi.string().required(),
        productid: Joi.string().required(),
        requeststatus: Joi.number().required()
    });
    validateRequest(req, next, schema);
}

// Approve Customer Request
async function approveProductListingRequest(req, res, next) {a

    const {merchantid,customerid,productid,requeststatus } = req.body;
    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,merchantid);
    const ifemployeeandhaspermission = await employeecheck(employeeid,merchantid,"Sales","edit");
    if (merchantid !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to make the change' });
    }
    requestservice.approveProductListingRequest({merchantid,customerid,productid,requeststatus, ipAddress })
    .then(() => res.json({ message: 'Approval request has been updated' }))
    .catch(next);
}

// Get Approved Customers
async function getApprovedCustomers(req, res, next) {

    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const merchantid = req.params.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,merchantid);
    const ifemployeeandhaspermission = await employeecheck(employeeid,merchantid,"Sales","edit");
    if (merchantid !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to get approved customers' });
    }
    requestservice.getApprovedCustomers({merchantid, ipAddress })
    .then((customers) => {
        console.log(customers);
        res.json(customers);

    })
    .catch(next);
}

// Get Approved Customers
async function getApprovedMerchants(req, res, next) {

    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const customerid = req.params.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,customerid);
    const ifemployeeandhaspermission = await employeecheck(employeeid,customerid,"Sales","edit");
    if (customerid !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to get approved customers' });
    }
    requestservice.getApprovedMerchants({customerid, ipAddress })
    .then((merchants) => {
        console.log(merchants);
        res.json(merchants);

    })
    .catch(next);
}
