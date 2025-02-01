const config = require('config.json');
const jwt = require('jsonwebtoken');
const { iteratee, throttle } = require('underscore');
const db = require('_helpers/db');
var uuid = require('uuid');

module.exports = {
    updateCart,
    getCart,
    clearCart,
    checkout,
    placeOrder, 
    acceptOrder,
    deliverOrder,
    getOrdersPlaced,
    getOrdersRecieved,
    requestCancelOrder,
    approveCancelOrder,
    requestReturnOrder,
    returnApproveOrder,
    addPayment,
    getInvoice,
    getInvoices,
    getPayments
};

// Update Cart
async function updateCart({ customerid,item, ipAddress, origin}) 
{ 
    let cart = await db.Cart.findOne({ customerid:customerid });
    if(cart == null)
    {
        cart = new db.Cart();
        cart.customerid = customerid;
        owner_newitem_product = await db.Product.findOne({ _id:item.productid });
        cart.merchantid = owner_newitem_product.owner;
        cart.items.push({productid:item.productid,variantid:item.variantid,quantity:item.quantity}); 
    }      
    else
    {   
        if(cart.items.length == 0)
        {
            owner_newitem_product = await db.Product.findOne({ _id:item.productid });
            cart.merchantid = owner_newitem_product.owner;
            cart.items.push({productid:item.productid,variantid:item.variantid,quantity:item.quantity}); 
        }
        else
        {
            const owner_newitem_product = await db.Product.findOne({ _id:item.productid });
            if(cart.merchantid!=owner_newitem_product.owner)
                throw 'Not possible to add a product of another merchant. Clear cart and add';

            var newitem = true;
            for(let j=0;j<cart.items.length;j++)
            {
                if(cart.items[j].productid == item.productid && cart.items[j].variantid == item.variantid)
                {
                    cart.items[j].quantity += item.quantity;
                    newitem = false;
                }
            }

            if(newitem)
                cart.items.push({productid:item.productid,variantid:item.variantid,quantity:item.quantity});
        }
    }

    cart.amount = 0;
    for(let i=0;i<cart.items.length;i++)
    {
        const product = await db.Product.findOne({ _id:cart.items[i].productid });
        for(let j=0;j<product.productdetails.length;j++)
        {
            if(product.productdetails[j]._id == cart.items[i].variantid)
            {
                cart.amount=cart.amount + (product.productdetails[j].wholesaleprice* cart.items[i].quantity);
            }
        }
    }
   
    // Saving Cart
    await cart.save();
    var items = cart.items;
    var amount = cart.amount;
    return {
        amount,
        items
    };
}

//Get Cart of customer
async function getCart({ customerid, ipAddress, origin}) 
{ 
    let cart = await db.Cart.findOne({ customerid:customerid });
    if(cart!=null)
    {
        var items = cart.items;
        var amount = cart.amount;
        return {
            amount,
            items
        };
    }
    else    
        throw 'Customer not found . Or customer hasnt added to the cart yet';
        
}

//Clear Cart
async function clearCart({ customerid, ipAddress, origin}) 
{ 
    let cart = await db.Cart.findOne({ customerid:customerid });
    if(cart!=null)
    {
        cart.items = new Array();
        cart.merchantid ="";
        await cart.save();
    }
    else    
        throw 'Customer not found . Or customer hasnt added to the cart yet';
        
}

//Checkout
async function checkout({ customerid,merchantid,items, ipAddress, origin}) 
{     
    const creditsavailable = await getCreditsAvailable(merchantid,customerid);
    const customer_account = await db.Account.findOne({ _id:customerid });
    const merchant_account = await db.Account.findOne({ _id:merchantid });
    if(!customer_account.billingaddress|| !customer_account.shippingaddress)
    {
        throw 'Customer does not have a proper billing and shipping address';
    }
    if(!merchant_account.billingaddress|| !merchant_account.shippingaddress)
    {
        throw 'Merchant does not have a proper billing and shipping address';
    }

    let samestate = true;
    let amount =0;
    let cgst=0,sgst=0,igst=0;
    if(merchant_account.billingaddress.state!=customer_account.billingaddress.state)
        samestate=false;

    for(let i=0;i<items.length;i++)
    {
        const product = await db.Product.findOne({ _id:items[i].productid });
        for(let j=0;j<product.productdetails.length;j++)
        {
            if(product.productdetails[j]._id == items[i].variantid)
            {
                if(!product.productdetails[j].available)
                    throw 'Some items in the cart are not available';
                if(product.productdetails[j].minimumorder > items[i].quantity)
                    throw 'Some items are lesser than the minimum order quantity. Please check';

                const {wholesaleprice,discount} = await getPriceAndDiscount(merchantid,customerid,product._id,product.productdetails[j]);
                amount += ((wholesaleprice-(discount/100)*wholesaleprice) * items[i].quantity);
                if(samestate)
                {
                    cgst += ((wholesaleprice-(discount/100)*wholesaleprice) * items[i].quantity * (product.productdetails[j].cgst /100));
                    sgst += ((wholesaleprice-(discount/100)*wholesaleprice) * items[i].quantity * (product.productdetails[j].sgst /100));
                }
                else
                    igst += ((wholesaleprice-(discount/100)*wholesaleprice) * items[i].quantity * (product.productdetails[j].igst/100));
            }
        }
    }

    await checkCreditLimit(merchant,customer,amount);

    return {
        creditsavailable,
        amount,
        cgst,
        sgst,
        igst,
        items
    };

}
async function getCreditsAvailable(merchantid,customerid)
{
    let creditsavailable = 0,creditsused = 0;
    const creditnotes = await db.CreditNote.find({ customer:customerid,merchant:merchantid });
    for ( var i = 0; i < creditnotes.length; i++ ) 
    {
        creditsavailable += creditnotes[i].amount; 
    }
    const orders = await db.Order.find({ customer:customerid,merchant:merchantid });
    for ( var i = 0; i < orders.length; i++ ) 
    {
        creditsused += orders[i].creditsused; 
    }
    return creditsavailable - creditsused;

}
async function getPriceAndDiscount(merchantid,requester,productid,productdetails)
{
    var approvedcustomer = false;
    const subscriptionofmerchant = await db.Subscription.findOne({subscriptionuser:merchantid});
    let wholesaleprice,discount = 0;
    if(!subscriptionofmerchant.customprices)
    {
        wholesaleprice = productdetails.wholesaleprice;
        discount = productdetails.discount;
    }
    if(subscriptionofmerchant.approvedcustomers==null)
    {
        wholesaleprice = productdetails.wholesaleprice;
        discount = productdetails.discount;
    }
    else
    {    
        subscriptionofmerchant.approvedcustomers.forEach(element => {
        if(element.customerid===requester)
            if(element.approvalstatus === 1)
            approvedcustomer = true;
        });
        if(!approvedcustomer)
        {
            wholesaleprice = productdetails.wholesaleprice;
            discount = productdetails.discount;
        }
        else
        {
            let customprice = await db.CustomPrice.findOne({merchantid:merchantid,customerid:requester});
            if(customprice)
            {
                
                let found = false;
                for(let i=0;i<customprice.productprices.length;i++)
                {
                    if(customprice.productprices[i].productid == productid && customprice.productprices[i].variantid == productdetails._id)
                    {
                        wholesaleprice = customprice.productprices[i].wholesaleprice;
                        discount = customprice.productprices[i].discount;
                        found = true;
                    }
                }
                if(!found)
                {
                    wholesaleprice = productdetails.wholesaleprice;
                    discount = productdetails.discount;
                }
            }
            else
            {
                wholesaleprice = productdetails.wholesaleprice;
                discount = productdetails.discount;
            }
            

        }
    }  
    return {
        wholesaleprice,
        discount
    }

}

//Place Order
async function placeOrder({ merchant, customer,orderitems,amount,cgst,sgst,igst,creditsused,amountpaid,paymentmethod,ordercreatedby, ipAddress, origin}) 
{     
    const order = new db.Order();
    order.merchant = merchant;
    order.customer = customer;
    order.orderitems = orderitems; 
    order.orderstatus ='Waiting for confirmation';
    order.placeddate = Date.now();
    order.amount = amount;
    order.cgst = cgst;
    order.sgst = sgst;
    order.igst = igst;
    order.creditsused = creditsused;
    order.amountpaid = amountpaid;
    order.amountrefunded = 0;
    order.ordercreatedby = ordercreatedby;
    order.orderconfirmationcode = makeid(6);
    if(paymentmethod!="None")
        order.paymentmethod = paymentmethod;


    if(amountpaid!=0)
    {
        order.paymentdate = Date.now();
        const invoice = new db.Invoice();
        invoice.amount = amount;
        invoice.orderid = order._id;
        invoice.outstanding = amount - amountpaid;
        invoice.customer = customer;
        invoice.merchant = merchant;
        const subscription = await db.Subscription.findOne({ subscriptionuser:merchant });
        invoice.invoicenumber = subscription.invoiceprefixstring + subscription.lastinvoicenumber;
        subscription.lastinvoicenumber++;
        invoice.ifinvoice = true;
        invoice.createddate = Date.now();
        const invoicecustomfields = await db.InvoiceCustomFields.findOne({ merchant:merchant }); 
        if(invoicecustomfields)
        {
            for(let l=0;l< invoicecustomfields.customfields.length;l++)
            {
                const customfieldname = invoicecustomfields.customfields[l].fieldname;
                const fieldstringvalue = invoicecustomfields.customfields[l].fieldvalue;
                let customfieldvalue = 0;
                if(fieldstringvalue.split('*').length>1)
                {
                    customfieldvalue = (Number(fieldstringvalue.split('*')[0]) /100) * invoice.amount;
                }
                else
                {
                    customfieldvalue = Number(fieldstringvalue);
                }
                invoice.customfields.push({fieldname:customfieldname,fieldvalue:customfieldvalue});
            }
        }

        if(invoice.outstanding <= 0)
            invoice.paymentdone = true;
        else
            invoice.paymentdone = false;

        await subscription.save();
        await invoice.save();
    }
    await order.save();
}

//Check credit limit before placing order 
async function checkCreditLimit(merchantid,customerid,amount)
{
    const merchant_account = await db.Subscription.findOne({ subscriptionuser:merchantid });
    if (merchant_account == null || merchant_account == "") {
        throw("Not a valid customer")
    }
    else
    {
        let isanapprovedcustomer = false;
        let outstanding = 0;
        for(let l=0;l< merchant_account.approvedcustomers.length;l++)
        {
            if(merchant_account.approvedcustomers[l].customerid == customerid)
            {
                if(merchant_account.approvedcustomers[l].approvalstatus == 1)
                    isanapprovedcustomer = true;
                const invoices = await db.Invoice.find({merchant :merchant_account.approvedcustomers[l].merchantid,customer:customerid});
                for(let i=0;i< invoices.length;i++)
                    outstanding += invoices[i].outstanding;
                outstanding +=amount;
                if(outstanding > merchant_account.approvedcustomers[l].creditlimit)        
                        throw 'Credit limit exceeded';
            }  
        }
        if(!isanapprovedcustomer)
            throw 'Is not an approved customer';
    }
}

function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * 
 charactersLength));
   }
   return result;
}

//Accept Order
async function acceptOrder({ orderid, scheduleddate, ipAddress, origin}) 
{ 
    const order = await db.Order.findOne({ _id:orderid });
    order.scheduleddate = scheduleddate;
    order.orderstatus ='Order Processing';
    await order.save();
}

//Deliver Order
async function deliverOrder({ orderid, orderitems,orderdeliveredby, ipAddress, origin}) 
{ 
    const order = await db.Order.findOne({ _id:orderid });   
    order.delivereddate = Date.now();
    const subscription = await db.Subscription.findOne({ subscriptionuser:order.merchant });  
    let nowdate = new Date(Date.now());
    order.returnvaliditydate = nowdate.addDays(subscription.defaultreturnvalidity);
    order.orderstatus ='Order Delivered';
    order.orderdeliveredby = orderdeliveredby;

    for(let i=0;i<order.orderitems.length;i++)
    {
        for(let j=0;j<orderitems.length;j++)
        {
            if(order.orderitems[i].productid == orderitems[j].productid && order.orderitems[i].variantid == orderitems[j].variantid)
            {
                for(let k=0;k<orderitems[j].stockdelivered.length;k++)
                {       
                    order.orderitems[i].stockdelivered.push(orderitems[j].stockdelivered[k]);     
                }
            }
        }
    }

    //Recalculate order amount
    var samestate = false;
    if(order.igst == 0)
        samestate = true;

    order.amount = 0;
    order.cgst = 0;
    order.sgst = 0;
    order.igst = 0;

    for(let i=0;i<order.orderitems.length;i++)
    {
        const product = await db.Product.findOne({ _id:order.orderitems[i].productid });
        for(let j=0;j<product.productdetails.length;j++)
        {
            if(product.productdetails[j]._id == order.orderitems[i].variantid)
            {
                //Adding sales number on delivery
                if(product.productdetails[j].salesnumber)
                    product.productdetails[j].salesnumber +=  order.orderitems[i].quantity;
                else
                    product.productdetails[j].salesnumber =  order.orderitems[i].quantity;

                //Calculating price of delivered quantity and updating order
                const {wholesaleprice,discount} = await getPriceAndDiscount(order.merchant,order.customer,product._id,product.productdetails[j]);
                order.amount += ((wholesaleprice-(discount/100)*wholesaleprice) * order.orderitems[i].quantity);
                if(samestate)
                {
                    order.cgst += ((wholesaleprice-(discount/100)*wholesaleprice) * order.orderitems[i].quantity * (product.productdetails[j].cgst /100));
                    order.sgst += ((wholesaleprice-(discount/100)*wholesaleprice) * order.orderitems[i].quantity * (product.productdetails[j].sgst /100));
                }
                else
                {
                    order.igst += ((wholesaleprice-(discount/100)*wholesaleprice) * order.orderitems[i].quantity * (product.productdetails[j].igst/100));
                }
                await product.save();
            }
        }
    }
    await order.save();

    // Invoice modifications and credit note 
    const orderinvoice = await db.Invoice.findOne({ orderid:orderid });   
    if(!orderinvoice)
    {

        const invoice = new db.Invoice();
        invoice.orderid = order._id;
        invoice.amount = order.amount;
        invoice.outstanding = order.amount - order.amountpaid;
        invoice.customer = order.customer;
        invoice.merchant = order.merchant;
        invoice.invoicenumber = subscription.invoiceprefixstring + subscription.lastinvoicenumber;
        subscription.lastinvoicenumber++;
        invoice.ifinvoice = true;
        invoice.createddate = Date.now();

        const invoicecustomfields = await db.InvoiceCustomFields.findOne({ merchant:order.merchant }); 
        if(invoicecustomfields)
        {
            for(let l=0;l< invoicecustomfields.customfields.length;l++)
            {
                const customfieldname = invoicecustomfields.customfields[l].fieldname;
                const fieldstringvalue = invoicecustomfields.customfields[l].fieldvalue;
                let customfieldvalue = 0;
                if(fieldstringvalue.split('*').length>1)
                {
                    customfieldvalue = (Number(fieldstringvalue.split('*')[0]) /100) * invoice.amount;
                }
                else
                {
                    customfieldvalue = Number(fieldstringvalue);
                }
                invoice.customfields.push({fieldname:customfieldname,fieldvalue:customfieldvalue});
            }
        }

        if(invoice.outstanding <= 0)
            invoice.paymentdone = true;
        else
            invoice.paymentdone = false;

        await subscription.save();
        await invoice.save();

    }
    else
    {
        let creditamount = 0;
        if(!orderinvoice.paymentdone)
        {
            orderinvoice.amount = order.amount;
            orderinvoice.outstanding = order.amount - order.amountpaid;
            if(orderinvoice.outstanding <= 0)
            {
                orderinvoice.paymentdone = true;
                creditamount = (-orderinvoice.outstanding);
                orderinvoice.outstanding = 0;
            }
            else
                orderinvoice.paymentdone = false;

            const invoicecustomfields = await db.InvoiceCustomFields.findOne({ merchant:order.merchant }); 
            if(invoicecustomfields)
            {
                for(let l=0;l< invoicecustomfields.customfields.length;l++)
                {
                    for(let i=0;i< orderinvoice.customfields.length;i++)
                    {
                        if(orderinvoice.customfields[i].fieldname == invoicecustomfields.customfields[i].fieldname)
                        {
                            let customfieldvalue = 0;
                            const fieldstringvalue = invoicecustomfields.customfields[i].fieldvalue;
                            if(fieldstringvalue.split('*').length>1)
                            {
                                customfieldvalue = (Number(fieldstringvalue.split('*')[0]) /100) * orderinvoice.amount;
                            }
                            else
                            {
                                customfieldvalue = Number(fieldstringvalue);
                            }
                            orderinvoice.customfields[i].fieldvalue = customfieldvalue;
                        }
                    }
                }
            }

            await orderinvoice.save();
        }
        else
        {
            creditamount = order.amountpaid - order.amount;
        }

        if(creditamount>0)
        {   
            const creditnote = new db.CreditNote();
            creditnote.customer = order.customer;
            creditnote.merchant = order.merchant;
            creditnote.amount = creditamount;
            creditnote.creditpaid = false;
            creditnote.createddate = Date.now();
            await creditnote.save();
        }

    }    
    await removeStockOnOrder(order.orderitems);
}

//Remove From stock during order
async function removeStockOnOrder(orderitems) 
{ 
    for(let i=0;i< orderitems.length;i++)
    {
        for(let k=0;k< orderitems[i].stockdelivered.length;k++)
        {
            const product = await db.Product.findOne({ _id:orderitems[i].productid });
            for(let l=0;l< product.productdetails.length;l++)
            {
                if(product.productdetails[l]._id == orderitems[i].variantid)
                for(let m=0;m< product.productdetails[l].stock.length;m++)
                {
                    if(orderitems[i].stockdelivered[k].batchnumber == product.productdetails[l].stock[m].batchnumber)
                    {   
                        product.productdetails[l].stock[m].stockleft-= orderitems[i].stockdelivered[k].quantity;
                        if(product.productdetails[l].stock[m].stockleft<=0)
                            product.productdetails[l].stock.splice(m, 1);
                    }
                }
            }
            await product.save();     
        }
    }
}

Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}


async function getOrdersPlaced({ customer, orderstatus,merchant,time, ipAddress })
{
    var orders = new Array();
    if(orderstatus =="All")
    {
        if(merchant=="All")
        {
            if(time == 0)
            {
                const order = await db.Order.find({customer:customer}); 
                for(let i=0;i<order.length;i++)
                {
                    orders.push(order[i]);
                }
            }
            else
            {
                const order = await db.Order.find({customer:customer}); 
                for(let i=0;i<order.length;i++)
                if(order[i].placeddate.addMonths(time) > Date.now())
                    orders.push(order[i]);
            }
        }
        else
        {
            if(!db.isValidId(merchant))
            throw 'Invalid Merchant ID';
            const merchantaccount = await db.Account.find({_id:merchant}); 
            if(!merchantaccount)
                throw 'Invalid Merchant';

            if(time == 0)
            {
                const order = await db.Order.find({customer:customer,merchant:merchant}); 
                for(let i=0;i<order.length;i++)
                {
                    orders.push(order[i]);
                }
            }
            else
            {
                const order = await db.Order.find({customer:customer,merchant:merchant}); 
                for(let i=0;i<order.length;i++)
                if(order[i].placeddate.addMonths(time) > Date.now())
                    orders.push(order[i]);
            }
        }
    }
    else
    {
        if(orderstatus!='Waiting for confirmation' && orderstatus!='Order Processing' && orderstatus!='Order Delivered' && orderstatus!='Waiting for return confirmation' && orderstatus!='Order Returned' && orderstatus!='Order Cancelled' && orderstatus!='Order Refunded')
            throw 'Invalid order status';
        if(merchant=="All")
        {
            if(time == 0)
            {
                const order = await db.Order.find({customer:customer,orderstatus:orderstatus}); 
                for(let i=0;i<order.length;i++)
                {
                    orders.push(order[i]);
                }
            }
            else
            {
                const order = await db.Order.find({customer:customer,orderstatus:orderstatus}); 
                for(let i=0;i<order.length;i++)
                if(order[i].placeddate.addMonths(time) > Date.now())
                    orders.push(order[i]);
            }
        }
        else
        {   
            if(!db.isValidId(merchant))
                throw 'Invalid Merchant ID';
            const merchantaccount = await db.Account.find({_id:merchant}); 
            if(!merchantaccount)
                throw 'Invalid Merchant';

            if(time == 0)
            {
                const order = await db.Order.find({customer:customer,orderstatus:orderstatus,merchant:merchant}); 
                for(let i=0;i<order.length;i++)
                {
                    orders.push(order[i]);
                }
            }
            else
            {
                const order = await db.Order.find({customer:customer,orderstatus:orderstatus,merchant:merchant}); 
                for(let i=0;i<order.length;i++)
                if(order[i].placeddate.addMonths(time) > Date.now())
                    orders.push(order[i]);
            }
        }
    }
    return {orders};
}

async function getOrdersRecieved({ customer, orderstatus,merchant,time, ipAddress })
{
    var orders = new Array();
    if(orderstatus =="All")
    {
        if(customer=="All")
        {
            if(time == 0)
            {
                const order = await db.Order.find({merchant:merchant}); 
                for(let i=0;i<order.length;i++)
                {
                    orders.push(order[i]);
                }
            }
            else
            {
                const order = await db.Order.find({merchant:merchant}); 
                for(let i=0;i<order.length;i++)
                if(order[i].placeddate.addMonths(time) > Date.now())
                    orders.push(order[i]);
            }
        }
        else
        {
            if(!db.isValidId(customer))
                throw 'Invalid Customer ID';
            const customeraccount = await db.Account.find({_id:customer}); 
            if(!customeraccount)
                throw 'Invalid Customer';

            if(time == 0)
            {
                const order = await db.Order.find({customer:customer,merchant:merchant}); 
                for(let i=0;i<order.length;i++)
                {
                    orders.push(order[i]);
                }
            }
            else
            {
                const order = await db.Order.find({customer:customer,merchant:merchant}); 
                for(let i=0;i<order.length;i++)
                if(order[i].placeddate.addMonths(time) > Date.now())
                    orders.push(order[i]);
            }
        }
    }
    else
    {
        if(orderstatus!='Waiting for confirmation' && orderstatus!='Order processing' && orderstatus!='Order delivered' && orderstatus!='Waiting for return' && orderstatus!='Order returned' && orderstatus!='Waiting for cancellation' && orderstatus!='Order cancelled')
            throw 'Invalid order status';
        if(customer=="All")
        {
            if(time == 0)
            {
                const order = await db.Order.find({merchant:merchant,orderstatus:orderstatus}); 
                for(let i=0;i<order.length;i++)
                {
                    orders.push(order[i]);
                }
            }
            else
            {
                const order = await db.Order.find({merchant:merchant,orderstatus:orderstatus}); 
                for(let i=0;i<order.length;i++)
                if(order[i].placeddate.addMonths(time) > Date.now())
                    orders.push(order[i]);
            }
        }
        else
        {   
            if(!db.isValidId(customer))
                throw 'Invalid Customer ID';
            const customeraccount = await db.Account.find({_id:customer}); 
            if(!customeraccount)
                throw 'Invalid Customer';

            if(time == 0)
            {
                const order = await db.Order.find({customer:customer,orderstatus:orderstatus,merchant:merchant}); 
                for(let i=0;i<order.length;i++)
                {
                    orders.push(order[i]);
                }
            }
            else
            {
                const order = await db.Order.find({customer:customer,orderstatus:orderstatus,merchant:merchant}); 
                for(let i=0;i<order.length;i++)
                if(order[i].placeddate.addMonths(time) > Date.now())
                    orders.push(order[i]);
            }
        }
    }
    return {orders};
}

// Order Cancellation Request
async function requestCancelOrder({ orderid, ipAddress, origin}) 
{ 
    const order = await db.Order.findOne({ _id:orderid });
    order.cancellationrequesteddate = Date.now();
    order.cancellationstatus = 0; //0 requested //1 accepted //2 rejected 
    order.orderstatus ='Waiting for cancellation';
    await order.save();
}


// Respond to Order Cancellation Request
async function approveCancelOrder({ orderid,cancellationstatus, ipAddress, origin}) 
{ 
    const order = await db.Order.findOne({ _id:orderid });
    if(order.cancellationstatus==0)
    {
        if(cancellationstatus == 1)
        {
            order.cancellationstatus = 1;
            order.orderstatus ='Order Cancelled';
            let creditamount = order.amountpaid;
            if(creditamount>0)
            {   
                const creditnote = new db.CreditNote();
                creditnote.customer = order.customer;
                creditnote.merchant = order.merchant;
                creditnote.amount = creditamount;
                creditnote.creditpaid = false;
                creditnote.createddate = Date.now();
                await creditnote.save();
            }
        }
        else
        {
            order.cancellationstatus = 2;
            order.orderstatus ='Order Processing';
        }
        order.cancellationrespondeddate = Date.now();
        await order.save();
    }
    else
    {
        throw 'Cancellation request not available';
    }
}

// Order Return Request
async function requestReturnOrder({ orderid,returnitems, ipAddress, origin}) 
{ 
    const order = await db.Order.findOne({ _id:orderid });
    if(order.returnvaliditydate<Date.now())
        throw 'Cannot return. Validity Exceeded : '+ order.returnvaliditydate;
    for(let i=0;i<order.orderitems.length;i++)
    {
        for(let j=0;j<returnitems.length;j++)
        {
            if(order.orderitems[i].productid == returnitems[j].productid && order.orderitems[i].variantid == returnitems[j].variantid)
            {
                order.orderitems[i].returnquantity = returnitems[j].quantity;     
            }
        }
    }
    order.returnrequesteddate = Date.now();
    order.returnstatus = 0;
    order.orderstatus ='Waiting for return';
    await order.save();
}

//Return Approve Order
async function returnApproveOrder({ orderid, returnitems,orderreturnedby, ipAddress, origin}) 
{ 
    const order = await db.Order.findOne({ _id:orderid });  
    if(order.returnstatus!=0)
        throw 'Cannot find return request'; 
    order.returnrespondeddate = Date.now();
    order.orderstatus ='Order Returned';
    order.orderreturnedby = orderreturnedby;
    order.returnrequeststatus = 1;
    for(let i=0;i<order.orderitems.length;i++)
    {
        for(let j=0;j<returnitems.length;j++)
        {
            if(order.orderitems[i].productid == returnitems[j].productid && order.orderitems[i].variantid == returnitems[j].variantid)
            {
                order.orderitems[i].returnquantity = returnitems[j].quantity;
                order.orderitems[i].stockreturned = returnitems[j].stockreturned;     
            }
        }
    }
    
    //Recalculate amount
    var samestate = false;
    if(order.igst == 0)
        samestate = true;

    const oldamount = order.amount;
    order.amount = 0;
    order.cgst = 0;
    order.sgst = 0;
    order.igst = 0;
    for(let i=0;i<order.orderitems.length;i++)
    {
        const product = await db.Product.findOne({ _id:order.orderitems[i].productid });
        for(let j=0;j<product.productdetails.length;j++)
        {
            if(product.productdetails[j]._id == order.orderitems[i].variantid)
            {
                //Updating return count in product
                if(product.productdetails[j].returnnumber)
                    product.productdetails[j].returnnumber +=  order.orderitems[i].returnquantity;
                else
                    product.productdetails[j].returnnumber =  order.orderitems[i].returnquantity;

                //Calculating new price after return
                const {wholesaleprice,discount} = await getPriceAndDiscount(order.merchant,order.customer,product._id,product.productdetails[j]);
                order.amount += ((wholesaleprice-(discount/100)*wholesaleprice) * (order.orderitems[i].quantity - order.orderitems[i].returnquantity));
                if(samestate)
                {
                    order.cgst += ((wholesaleprice-(discount/100)*wholesaleprice) * (order.orderitems[i].quantity - order.orderitems[i].returnquantity) * (product.productdetails[j].cgst /100));
                    order.sgst += ((wholesaleprice-(discount/100)*wholesaleprice) * (order.orderitems[i].quantity - order.orderitems[i].returnquantity) * (product.productdetails[j].sgst /100));
                }
                else
                    order.igst += ((wholesaleprice-(discount/100)*wholesaleprice) * (order.orderitems[i].quantity - order.orderitems[i].returnquantity) * (product.productdetails[j].igst/100));
                
                await product.save();
            }
            
        }
    }

    const orderinvoice = await db.Invoice.findOne({ orderid:orderid });   
    if(orderinvoice)
    {
        let creditamount =0;
        if(!orderinvoice.paymentdone)
        {
            orderinvoice.amount = order.amount;
            orderinvoice.outstanding = order.amount - order.amountpaid;
            if(orderinvoice.outstanding <= 0)
            {
                orderinvoice.paymentdone = true;
                creditamount = (-orderinvoice.outstanding);
                orderinvoice.outstanding = 0;
            }
            else
                orderinvoice.paymentdone = false;

            const invoicecustomfields = await db.InvoiceCustomFields.findOne({ merchant:order.merchant }); 
            if(invoicecustomfields)
            {
                for(let l=0;l< invoicecustomfields.customfields.length;l++)
                {
                    for(let i=0;i< orderinvoice.customfields.length;i++)
                    {
                        if(orderinvoice.customfields[i].fieldname == invoicecustomfields.customfields[i].fieldname)
                        {
                            let customfieldvalue = 0;
                            const fieldstringvalue = invoicecustomfields.customfields[i].fieldvalue;
                            if(fieldstringvalue.split('*').length>1)
                            {
                                customfieldvalue = (Number(fieldstringvalue.split('*')[0]) /100) * orderinvoice.amount;
                            }
                            else
                            {
                                customfieldvalue = Number(fieldstringvalue);
                            }
                            orderinvoice.customfields[i].fieldvalue = customfieldvalue;
                        }
                    }
                }
            }
        }
        else
        {
            creditamount = oldamount - order.amount;
        }

        if(creditamount>0)
        {   
            const creditnote = new db.CreditNote();
            creditnote.customer = order.customer;
            creditnote.merchant = order.merchant;
            creditnote.amount = creditamount;
            creditnote.creditpaid = false;
            creditnote.createddate = Date.now();
            await creditnote.save();
        }

        await orderinvoice.save();
    }

    await order.save();
    await addStockOnReturn(order.orderitems);
}

//Add To stock on return
async function addStockOnReturn(orderitems) 
{ 
    for(let i=0;i< orderitems.length;i++)
    {
        for(let k=0;k< orderitems[i].stockreturned.length;k++)
        {               
            const product = await db.Product.findOne({ _id:orderitems[i].productid });
            for(let l=0;l< product.productdetails.length;l++)
            {
                if(product.productdetails[l]._id == orderitems[i].variantid)
                {
                    let newstock = true;
                    for(let m=0;m< product.productdetails[l].stock.length;m++)
                    {
                        if(orderitems[i].stockreturned[k].batchnumber == product.productdetails[l].stock[m].batchnumber)
                        {   
                            product.productdetails[l].stock[m].stockleft+= orderitems[i].stockreturned[k].quantity;
                            newstock = false;
                        }
                    }
                    if(newstock)
                        product.productdetails[l].stock.push({"batchnumber": orderitems[i].stockreturned[k].batchnumber,"expirydate": orderitems[i].stockreturned[k].expirydate,"updateddate":new Date(Date.now()),"stockleft":orderitems[i].stockreturned[k].quantity});
                }
            }      
            await product.save();     
        }
    }
}

//Add Payment
async function addPayment({ customer, merchant,invoicesincluded,amountpaid,paymentmethod, ipAddress }) 
{ 
    for(let i=0;i<invoicesincluded.length;i++)
    {
        const invoice = await db.Invoice.findOne({ merchant:merchant,customer:customer,_id:invoicesincluded[i].invoiceid }); 
        invoice.outstanding -= invoicesincluded[i].amountpaid;
        if(invoice.outstanding <= 0)
            invoice.paymentdone = true;
        await invoice.save();
        const order = await db.Order.findOne({ _id:invoice.orderid }); 
        order.amountpaid += invoicesincluded[i].amountpaid;
        order.paymentmethod = paymentmethod;
        order.paymentdate = Date.now();
        await order.save();
    }
    const payment  = new db.Payment();
    payment.customer = customer;
    payment.merchant = merchant;
    payment.invoicesincluded = invoicesincluded;
    payment.amountpaid = amountpaid;
    payment.paymentmethod = paymentmethod;
    payment.paymentdate = Date.now();
    await payment.save();
}

// Get Invoice by id
async function getInvoice({ invoiceid, ipAddress, origin}) 
{ 
    const invoice = await db.Invoice.findOne({ _id:invoiceid });
    return invoice;
}

// Get Invoices
async function getInvoices({ customer,merchant,paymentdone,time, ipAddress, origin}) 
{ 
    let invoices;
    if(customer =="All")
    {
        invoices = await db.Invoice.find({ merchant:merchant,paymentdone:paymentdone });
    }
    if(merchant =="All")
    {
        invoices = await db.Invoice.find({ customer:customer,paymentdone:paymentdone });
    }
    if(merchant !="All" && customer !="All")
    {
        invoices = await db.Invoice.find({ merchant:merchant,customer:customer,paymentdone:paymentdone });
    }

    const returninvoices = new Array();
    if(time == 0)
        return invoices;
    for(let i=0;i<invoices.length;i++)
    {
        if(invoices[i].createddate.addMonths(time) > Date.now())
            returninvoices.push(invoices[i]);
    }
    return returninvoices;
}

// Get Payments
async function getPayments({ customer,merchant,time, ipAddress, origin}) 
{
    let payments;
    if(customer =="All")
    {
        payments = await db.Payment.find({ merchant:merchant });
    }
    if(merchant =="All")
    {
        payments = await db.Payment.find({ customer:customer });
    }
    if(merchant !="All" && customer !="All")
    {
        payments = await db.Payment.find({ merchant:merchant,customer:customer });
    }

    const returnpayments = new Array();
    if(time == 0)
        return payments;
    
    for(let i=0;i<payments.length;i++)
    {
        if(payments[i].paymentdate.addMonths(time) > Date.now())
            returnpayments.push(payments[i]);
    }

    return returnpayments;
}