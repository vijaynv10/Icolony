const express = require('express');
const router = express.Router();
const Joi = require('joi-oid');
const validateRequest = require('_middleware/validate-request');
const authorize = require('_middleware/authorize')
const Role = require('_helpers/role');
const orderservice = require('./orders.service');
var _ = require('underscore');
const multer = require('multer');
const path = require('path');
var fs = require('fs');
const db = require('_helpers/db');

// Routes
router.post('/update-cart',authorize(), updateCartSchema, updateCart);
router.post('/clear-cart/:id',authorize(), clearCart);
router.get('/get-cart/:id',authorize(), getCart);
router.post('/checkout',authorize(), checkoutSchema, checkout);
router.post('/place-order',authorize(), placeOrderSchema, placeOrder);
router.post('/accept-order',authorize(), acceptOrderSchema, acceptOrder);
router.post('/deliver-order',authorize(), deliverOrderSchema, deliverOrder);
router.post('/add-payment',authorize(), addPaymentSchema, addPayment);
router.get('/get-orders-placed',authorize(), getOrdersPlacedSchema, getOrdersPlaced);
router.get('/get-orders-recieved',authorize(), getOrdersRecievedSchema, getOrdersRecieved);
router.get('/get-invoice/:id',authorize(), getInvoice);
router.get('/get-invoices/',authorize(), getInvoicesSchema, getInvoices);
router.get('/get-payments/',authorize(), getPaymentsSchema, getPayments);
router.post('/request-cancel-order',authorize(), requestCancelOrderSchema, requestCancelOrder);
router.post('/request-return-order',authorize(), requestReturnOrderSchema, requestReturnOrder);
router.post('/approve-cancel-order',authorize(), approveCancelOrderSchema, approveCancelOrder);
router.post('/approve-return-order',authorize(), returnApproveOrderSchema, returnApproveOrder);
module.exports = router;

/*
// authorize function --------------------------
function authorizecall(req, res, next) {
    authorize()
    .then(next)
    .catch(() => res.json({ message: 'Unauthorized' })); 
}
*/
async function deliverypersoncheck(deliverypersonid,ownerid)
{ 
    const deliveryperson = await db.DeliveryPerson.findById(deliverypersonid);
    if(!deliveryperson)
        return false;

    if(deliveryperson.owner == ownerid)
        return true;
    else
        return false; 
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

function updateCartSchema(req, res, next) {
    const schema = Joi.object({
        customerid: Joi.string().required(),
        item: Joi.object({
            productid: Joi.string().required(),
            variantid: Joi.string().required(),
            quantity: Joi.number().required(),
        })
    });
    validateRequest(req, next, schema);
}

// Update Cart
async function updateCart(req, res, next) {
    const { customerid, item} = req.body;
    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,customerid);
    const ifemployeeandhaspermission = await employeecheck(employeeid,customerid,"Purchases","edit");
    if (customerid !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to make the change' });
    }

    orderservice.updateCart({ customerid,item, ipAddress })
    .then(({  amount,items }) => {
        const cartMerge = {items , amount};
        res.json(cartMerge);
    })
    .catch(next);
} 

async function getCart(req, res, next) {
    const customerid = req.params.id;
    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,customerid);
    const ifemployeeandhaspermission = await employeecheck(employeeid,customerid,"Purchases","edit");
    if (customerid !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to get cart' });
    }

    orderservice.getCart({ customerid, ipAddress })
    .then(({  amount,items }) => {
        const cartMerge = {items , amount};
        res.json(cartMerge);
    })
    .catch(next);
} 
async function clearCart(req, res, next) {
    const customerid = req.params.id;
    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,customerid);
    const ifemployeeandhaspermission = await employeecheck(employeeid,customerid,"Purchases","edit");
    if (customerid !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to clear cart' });
    }

    orderservice.clearCart({ customerid, ipAddress })
    .then(() => res.json({ message: 'Cart Cleared' }))
    .catch(next);
} 

function checkoutSchema(req, res, next) {
    const schema = Joi.object({
        customerid: Joi.string().required(),
        merchantid: Joi.string().required(),
        items: Joi.array()
        .items({
            productid: Joi.string().required(),
            variantid: Joi.string().required(),
            quantity: Joi.number().required(),
        }),
    });
    validateRequest(req, next, schema);
}

// Checkout . This is where your address detials are checked and gst is calculated
async function checkout(req, res, next) {
    const { customerid,merchantid, items} = req.body;
    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,customerid);
    const ifemployeeandhaspermission = await employeecheck(employeeid,customerid,"Purchases","edit");
    if (customerid !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to make the change' });
    }

    orderservice.checkout({ customerid,merchantid,items, ipAddress })
    .then(({ creditsavailable,amount,cgst,sgst,igst,items }) => {
        const checkout = {items ,creditsavailable, amount,cgst,sgst,igst};
        res.json(checkout);
    })
    .catch(next);
} 

function placeOrderSchema(req, res, next) {
    const schema = Joi.object({
        merchant: Joi.string().required(),
        customer: Joi.string().required(),
        orderitems: Joi.array()
        .items({
            productid: Joi.string().required(),
            variantid: Joi.string().required(),
            quantity: Joi.number().required(),
        }),
        amount: Joi.number().required(),
        cgst: Joi.number().required(),
        sgst:Joi.number().required(),
        igst: Joi.number().required(),
        creditsused:Joi.number().required(),
        amountpaid:Joi.number().required(),
        paymentmethod:Joi.string().required(),
        ordercreatedby:Joi.string().required()
    });
    validateRequest(req, next, schema);
}

// Place Order
async function placeOrder(req, res, next) {
    const { merchant, customer,orderitems,amount,cgst,sgst,igst,creditsused,amountpaid,paymentmethod,ordercreatedby} = req.body;
    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,customer);
    const ifemployeeandhaspermission = await employeecheck(employeeid,customer,"Purchases","edit");
    if (customer !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to place order' });
    }

    orderservice.placeOrder({ merchant, customer,orderitems,amount,cgst,sgst,igst,creditsused,amountpaid,paymentmethod,ordercreatedby, ipAddress })
    .then(() => res.json({ message: 'Order Placed' }))
    .catch(next);
} 

function acceptOrderSchema(req, res, next) {
    const schema = Joi.object({
        orderid: Joi.string().required(),
        scheduleddate: Joi.date().required(),
    });
    validateRequest(req, next, schema);
}

// Place Order
async function acceptOrder(req, res, next) {
    const { orderid, scheduleddate} = req.body;
    const order = await db.Order.findOne({ _id:orderid });
    const ipAddress = req.ip;
    if(!order)
        return res.status(401).json({ message: 'Order not found' });
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,order.merchant);
    const ifemployeeandhaspermission = await employeecheck(employeeid,order.merchant,"Sales","edit");
    if (order.merchant !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to accept order' });
    }

    orderservice.acceptOrder({ orderid, scheduleddate, ipAddress })
    .then(() => res.json({ message: 'Order Accepted' }))
    .catch(next);
} 

function deliverOrderSchema(req, res, next) {
    const schema = Joi.object({
        orderid: Joi.string().required(),
        orderconfirmationcode: Joi.string().required(),
        orderitems: Joi.array()
        .items({
            productid: Joi.string().required(),
            variantid: Joi.string().required(),
            quantity: Joi.number().required(),
            stockdelivered: Joi.array()
            .items({
                batchnumber: Joi.string().required(),
                quantity: Joi.number().required(),
                expirydate: Joi.date().required(), 
            })
        }),
        orderdeliveredby: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

// Deliver Order
async function deliverOrder(req, res, next) {
    const { orderid,orderconfirmationcode, orderitems,orderdeliveredby} = req.body;
    const order = await db.Order.findOne({ _id:orderid });
    const ipAddress = req.ip;
    if(!order)
    return res.status(401).json({ message: 'Order not found' });
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const deliverypersonid = req.user.id;
    const ifdeliveryperson = await deliverypersoncheck(deliverypersonid,order.merchant);
    const ifsupermerchant = await supermerchantcheck(supermerchantid,order.merchant);
    const ifemployeeandhaspermission = await employeecheck(employeeid,order.merchant,"Sales","edit");
    if (order.merchant !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant && !ifdeliveryperson) {
        return res.status(401).json({ message: 'Unauthorized to deliver order' });
    }
    if (order.orderconfirmationcode !== orderconfirmationcode) {
        return res.status(401).json({ message: 'Unauthorized to deliver order. Wrong confirmation code' });
    }
    orderservice.deliverOrder({ orderid, orderitems,orderdeliveredby, ipAddress })
    .then(() => res.json({ message: 'Order Delivered' }))
    .catch(next);
} 


function getOrdersPlacedSchema(req, res, next) {
    const schema = Joi.object({
        customer: Joi.string().required(),
        orderstatus: Joi.string().required(),
        merchant: Joi.string().required(),
        time:Joi.number().required() // Number in last months (12 for last 1 year )
    });
    validateRequest(req, next, schema);
}

// Get orders placed by customer
async function getOrdersPlaced(req, res, next) {
    const { customer, orderstatus,merchant,time} = req.body;
    const ipAddress = req.ip;

    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,customer);
    const ifemployeeandhaspermission = await employeecheck(employeeid,customer,"Purchases","edit");
    if (customer !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to get list of orders placed' });
    }
    orderservice.getOrdersPlaced({ customer, orderstatus,merchant,time, ipAddress })
    .then(({ orders }) => {
        res.json(orders);
    })
    .catch(next);
} 

function getOrdersRecievedSchema(req, res, next) {
    const schema = Joi.object({
        customer: Joi.string().required(),
        orderstatus: Joi.string().required(),
        merchant: Joi.string().required(),
        time:Joi.number().required() // Number in last months (12 for last 1 year )
    });
    validateRequest(req, next, schema);
}

// Get orders recieved by merchant
async function getOrdersRecieved(req, res, next) {
    const { customer, orderstatus,merchant,time} = req.body;
    const ipAddress = req.ip;

    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const deliverypersonid = req.user.id;
    const ifdeliveryperson = await deliverypersoncheck(deliverypersonid,merchant);
    const ifsupermerchant = await supermerchantcheck(supermerchantid,merchant);
    const ifemployeeandhaspermission = await employeecheck(employeeid,merchant,"Sales","edit");
    if (merchant !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant && !ifdeliveryperson) {
        return res.status(401).json({ message: 'Unauthorized to get list of orders recieved' });
    }
    orderservice.getOrdersRecieved({ customer, orderstatus,merchant,time, ipAddress })
    .then(({ orders }) => {
        res.json(orders);
    })
    .catch(next);
} 


function requestCancelOrderSchema(req, res, next) {
    const schema = Joi.object({
        orderid: Joi.string().required(),
    });
    validateRequest(req, next, schema);
}

// Request Cancel Order
async function requestCancelOrder(req, res, next) {
    const { orderid} = req.body;
    const order = await db.Order.findOne({ _id:orderid });
    const ipAddress = req.ip;
    if(!order)
    return res.status(401).json({ message: 'Order not found' });
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,order.customer);
    const ifemployeeandhaspermission = await employeecheck(employeeid,order.customer,"Purchases","edit");
    if (order.customer !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to cancel order' });
    }

    orderservice.requestCancelOrder({ orderid, ipAddress })
    .then(() => res.json({ message: 'Order Cancellation Requested' }))
    .catch(next);
} 


function approveCancelOrderSchema(req, res, next) {
    const schema = Joi.object({
        orderid: Joi.string().required(),
        cancellationstatus: Joi.number().required()
    });
    validateRequest(req, next, schema);
}

// Approve Cancel Order
async function approveCancelOrder(req, res, next) {
    const { orderid,cancellationstatus} = req.body;
    const order = await db.Order.findOne({ _id:orderid });
    const ipAddress = req.ip;
    if(!order)
    return res.status(401).json({ message: 'Order not found' });
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,order.merchant);
    const ifemployeeandhaspermission = await employeecheck(employeeid,order.merchant,"Sales","edit");
    if (order.merchant !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to modify order' });
    }

    orderservice.approveCancelOrder({ orderid,cancellationstatus, ipAddress })
    .then(() => res.json({ message: 'Order Cancellation Responded' }))
    .catch(next);
} 


function requestReturnOrderSchema(req, res, next) {
    const schema = Joi.object({
        orderid: Joi.string().required(),
        returnitems: Joi.array()
        .items({
            productid: Joi.string().required(),
            variantid: Joi.string().required(),
            quantity: Joi.number().required(),
        })
    });
    validateRequest(req, next, schema);
}

// Order Return Request
async function requestReturnOrder(req, res, next) {
    const { orderid,returnitems} = req.body;
    const order = await db.Order.findOne({ _id:orderid });
    const ipAddress = req.ip;
    if(!order)
    return res.status(401).json({ message: 'Order not found' });
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,order.customer);
    const ifemployeeandhaspermission = await employeecheck(employeeid,order.customer,"Purchases","edit");
    if (order.customer !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to modify order' });
    }

    orderservice.requestReturnOrder({ orderid,returnitems, ipAddress })
    .then(() => res.json({ message: 'Order Return Requested' }))
    .catch(next);
} 

function returnApproveOrderSchema(req, res, next) {
    const schema = Joi.object({
        orderid: Joi.string().required(),
        returnitems: Joi.array()
        .items({
            productid: Joi.string().required(),
            variantid: Joi.string().required(),
            quantity: Joi.number().required(),
            stockreturned: Joi.array()
            .items({
                batchnumber: Joi.string().required(),
                quantity: Joi.number().required(),
                expirydate: Joi.date().required(), 
            })
        }),
        orderreturnedby: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

// Return Order Approval
async function returnApproveOrder(req, res, next) {
    const { orderid, returnitems,orderreturnedby} = req.body;
    const order = await db.Order.findOne({ _id:orderid });
    const ipAddress = req.ip;
    if(!order)
    return res.status(401).json({ message: 'Order not found' });
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const deliverypersonid = req.user.id;
    const ifdeliveryperson = await deliverypersoncheck(deliverypersonid,order.merchant);
    const ifsupermerchant = await supermerchantcheck(supermerchantid,order.merchant);
    const ifemployeeandhaspermission = await employeecheck(employeeid,order.merchant,"Sales","edit");
    if (order.merchant !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant && !ifdeliveryperson) {
        return res.status(401).json({ message: 'Unauthorized to return order' });
    }
    orderservice.returnApproveOrder({ orderid, returnitems,orderreturnedby, ipAddress })
    .then(() => res.json({ message: 'Order Returned' }))
    .catch(next);
} 

function addPaymentSchema(req, res, next) {
    const schema = Joi.object({
        customer: Joi.string().required(),
        merchant: Joi.string().required(),
        invoicesincluded: Joi.array()
        .items({
            invoiceid: Joi.string().required(),
            amountpaid: Joi.number().required()
        }),
        amountpaid: Joi.number().required(),
        paymentmethod: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

// Add Payment 
async function addPayment(req, res, next) {
    const { customer, merchant,invoicesincluded,amountpaid,paymentmethod} = req.body;
    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const deliverypersonid = req.user.id;
    const ifdeliveryperson = await deliverypersoncheck(deliverypersonid,merchant);
    const ifsupermerchant = await supermerchantcheck(supermerchantid,merchant);
    const ifemployeeandhaspermission = await employeecheck(employeeid,merchant,"Payments","edit");
    if (merchant !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant && !ifdeliveryperson) {
        return res.status(401).json({ message: 'Unauthorized to add payment' });
    }
    orderservice.addPayment({ customer, merchant,invoicesincluded,amountpaid,paymentmethod, ipAddress })
    .then(() => res.json({ message: 'Payment Added' }))
    .catch(next);
} 

// Get Invoice 
async function getInvoice(req, res, next) {
    const invoiceid = req.params.id;
    const invoice = await db.Invoice.findById(invoiceid);
    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id; 
    if (!invoice)
        return res.status(401).json({ message: 'Invoice not found' });
    const ifsupermerchant1 = await supermerchantcheck(supermerchantid,invoice.merchant);
    const ifsupermerchant2 = await supermerchantcheck(supermerchantid,invoice.customer);
    const ifemployeeandhaspermission1 = await employeecheck(employeeid,invoice.merchant,"Sales","view");
    const ifemployeeandhaspermission2 = await employeecheck(employeeid,invoice.customer,"Purchases","view");
    if (invoice.customer!== req.user.id && invoice.merchant !== req.user.id && !ifemployeeandhaspermission1 &&  !ifemployeeandhaspermission2 && !ifsupermerchant1 && !ifsupermerchant2 ) {
        return res.status(401).json({ message: 'Unauthorized to  get invoice' });
    }
    orderservice.getInvoice({ invoiceid, ipAddress })
    .then(( invoice ) => {
        res.json(invoice);
    })
} 

function getInvoicesSchema(req, res, next) {
    const schema = Joi.object({
        customer: Joi.string().required(),
        paymentdone: Joi.boolean().required(),
        merchant: Joi.string().required(),
        time:Joi.number().required() // Number in last months (12 for last 1 year )
    });
    validateRequest(req, next, schema);
}

// Get Invoices between customer and merchant
async function getInvoices(req, res, next) {
    const ipAddress = req.ip;
    const {customer,merchant,paymentdone,time} = req.body;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id; 
    const deliverypersonid = req.user.id;
    const ifdeliveryperson = await deliverypersoncheck(deliverypersonid,merchant);
    const ifsupermerchant1 = await supermerchantcheck(supermerchantid,merchant);
    const ifsupermerchant2 = await supermerchantcheck(supermerchantid,customer);
    const ifemployeeandhaspermission1 = await employeecheck(employeeid,merchant,"Sales","view");
    const ifemployeeandhaspermission2 = await employeecheck(employeeid,customer,"Purchases","view");
    if (customer!== req.user.id && merchant !== req.user.id && !ifemployeeandhaspermission1 &&  !ifemployeeandhaspermission2 && !ifsupermerchant1 && !ifsupermerchant2&& !ifdeliveryperson) {
        return res.status(401).json({ message: 'Unauthorized to  get invoices' });
    }
    orderservice.getInvoices({ customer,merchant,paymentdone,time, ipAddress })
    .then(( invoices ) => {
        res.json(invoices);
    })
} 

function getPaymentsSchema(req, res, next) {
    const schema = Joi.object({
        customer: Joi.string().required(),
        merchant: Joi.string().required(),
        time:Joi.number().required() // Number in last months (12 for last 1 year )
    });
    validateRequest(req, next, schema);
}

// Get Invoices between customer and merchant
async function getPayments(req, res, next) {
    const ipAddress = req.ip;
    const {customer,merchant,time} = req.body;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id; 
    const ifsupermerchant1 = await supermerchantcheck(supermerchantid,merchant);
    const ifsupermerchant2 = await supermerchantcheck(supermerchantid,customer);
    const ifemployeeandhaspermission1 = await employeecheck(employeeid,merchant,"Sales","view");
    const ifemployeeandhaspermission2 = await employeecheck(employeeid,customer,"Purchases","view");
    if (customer!== req.user.id && merchant !== req.user.id && !ifemployeeandhaspermission1 &&  !ifemployeeandhaspermission2 && !ifsupermerchant1 && !ifsupermerchant2) {
        return res.status(401).json({ message: 'Unauthorized to  get payments' });
    }
    orderservice.getPayments({ customer,merchant,time, ipAddress })
    .then(( payments ) => {
        res.json(payments);
    })
} 