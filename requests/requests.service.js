const config = require('config.json');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require("crypto");
const sendEmail = require('_helpers/send-email');
const db = require('_helpers/db');
var uuid = require('uuid');
const { custom } = require('joi');

module.exports = {
    customerRequest,
    approveCustomerRequest,
    productListingRequest,
    approveProductListingRequest,
    getApprovedCustomers,
    getApprovedMerchants
};

//Sending customer request
async function customerRequest({ merchantid,customerid, ipAddress, origin}) {
  
    //Checking if merchant has subscription
    const merchant_account = await db.Subscription.findOne({ subscriptionuser:merchantid });
    if (merchant_account == null || merchant_account == "") {
        throw("Not a valid merchant")
    }
    else
    {
        //Checking if customer is valid
        const customer_account = await db.Account.findOne({ _id:customerid });
        if (merchant_account == null || merchant_account == "") {
            throw("Not a valid customer")
        }

        var newrequest= true;
        customer_account.approvedmerchants.forEach(element => {
        if(element.merchantid===merchantid)
            {
                element.approvalstatus=0;
                newrequest = false;
            }
        });
        merchant_account.approvedcustomers.forEach(element => {
            if(element.customerid===customerid)
                {
                    element.approvalstatus=0;
                    newrequest = false;
                }
            });
        if(newrequest)
        {
            customer_account.approvedmerchants.push({merchantid:merchantid,approvalstatus:0});
            merchant_account.approvedcustomers.push({customerid:customerid,approvalstatus:0});
        }
        
        await customer_account.save();
        await merchant_account.save();
    }
}  

//Approving customer request
async function approveCustomerRequest({ merchantid,customerid,creditlimit,customprices,approvalstatus, ipAddress, origin}) {

    //Checking if merchant has subscription
    const merchant_account = await db.Subscription.findOne({ subscriptionuser:merchantid });
    if (merchant_account == null || merchant_account == "") {
        throw("Not a valid merchant")
    }
    else
    {
        //Checking if customer is valid
        const customer_account = await db.Account.findOne({ _id:customerid });
        if (merchant_account == null || merchant_account == "") {
            throw("Not a valid customer")
        }

        customer_account.approvedmerchants.forEach(element => {
        if(element.merchantid===merchantid)
            {
                element.approvalstatus=approvalstatus;
                element.customprices=customprices;
                element.creditlimit = creditlimit;
            }
        });
        merchant_account.approvedcustomers.forEach(element => {
            if(element.customerid===customerid)
                {
                    element.approvalstatus=approvalstatus;
                    element.customprices=customprices;
                    element.creditlimit = creditlimit;
                }
            });
        
        await customer_account.save();
        await merchant_account.save();
    }
}  

//Sending product listing request
async function productListingRequest({ merchantid,customerid,productid, ipAddress, origin}) {

    //Checking if merchant has subscription
    const merchant_account = await db.Subscription.findOne({ subscriptionuser:merchantid });
    if (merchant_account == null || merchant_account == "") {
        throw("Not a valid merchant")
    }
    else
    {
        //Checking if customer has subscription and customer is valid
        const customer_account = await db.Account.findOne({ _id:customerid });
        const customer_account_subscription = await db.Subscription.findOne({ subscriptionuser:customerid });
        if (customer_account == null || customer_account == "") {
            throw("Not a valid customer")
        }

        if (customer_account_subscription == null || customer_account_subscription == "") {
            throw("Customer does not have a valid subscription")
        }

        //Only approved customers can ask product listing request to a merchant
        var isanapprovedmerchant= false;
        customer_account.approvedmerchants.forEach(element => {
        if(element.merchantid===merchantid)
            {
                if(element.approvalstatus===1)
                    isanapprovedmerchant = true;
            }
        });

        if(!isanapprovedmerchant)
            throw("Customer is not an approved customer of the product owner")    
        else
        {
            var newrequest = true;
            customer_account.approvedmerchants.forEach(element => {
                if(element.merchantid===merchantid)
                    {
                        element.productlistingrequests.forEach(element => {
                            if(element.productid===productid)
                            {
                                newrequest = false;
                                element.approvalstatus = 0;
                            }
                        });
                    }
                });

                merchant_account.approvedcustomers.forEach(element => {
                if(element.customerid===customerid)
                    {
                        element.productlistingrequests.forEach(element => {
                            if(element.productid===productid)
                            {
                                newrequest = false;
                                element.approvalstatus = 0;
                            }
                        });
                    }
                });
        }
        
        
        if(newrequest)
        {
            customer_account.approvedmerchants.forEach(element => {
                if(element.merchantid===merchantid)
                    {
                        element.productlistingrequests.push({productid:productid,approvalstatus:0});
                    }
                });
                merchant_account.approvedcustomers.forEach(element => {
                if(element.customerid===customerid)
                    {
                        element.productlistingrequests.push({productid:productid,approvalstatus:0});
                    }
                });
         }

        await customer_account.save();
        await merchant_account.save();
    }
}  

//Approving product listing request
async function approveProductListingRequest({ merchantid,customerid,productid,requeststatus, ipAddress, origin}) {

    var producttoremove='';
    var needtoaddproduct = false;
    var requestfound = false;
    //Checking if merchant has subscription
    const merchant_account = await db.Subscription.findOne({ subscriptionuser:merchantid });
    if (merchant_account == null || merchant_account == "") {
        throw("Not a valid merchant")
    }
    else
    {
        //Checking if customer has subscription and customer is valid
        const customer_account = await db.Account.findOne({ _id:customerid });
        const customer_account_subscription = await db.Subscription.findOne({ subscriptionuser:customerid });
        if (customer_account == null || customer_account == "") {
            throw("Not a valid customer")
        }

        if (customer_account_subscription == null || customer_account_subscription == "") {
            throw("Customer does not have a valid subscription")
        }

        //Only approved customers can ask product listing request to a merchant
        var isanapprovedmerchant= false;
        customer_account.approvedmerchants.forEach(element => {
        if(element.merchantid===merchantid)
            {
                if(element.approvalstatus===1)
                    isanapprovedmerchant = true;
            }
        });

        const product = await db.Product.findOne({ _id:productid });
        const listedproduct = new db.Product();
        listedproduct.productname= product.productname;
        listedproduct.category = product.category;
        listedproduct.subcategory = product.subcategory;
        listedproduct.productdetails = product.productdetails;
        listedproduct.hsncode = product.hsncode;
        listedproduct.owner = product.owner;
        listedproduct.listedby= customerid;
        listedproduct.addedby = product.addedby;
        listedproduct.createdDTS= Date.now();
        listedproduct.lastupdatedIP= product.ipAddress;
        listedproduct.available = false;

        if(!isanapprovedmerchant)
            throw("Customer is not an approved customer of the product owner")    
        else
        {
            const merchant_account = await db.Subscription.findOne({ subscriptionuser:merchantid });

            //Setting the lesser of two validities (distributor and merchant)
            if(customer_account_subscription.validity<merchant_account.validity)
                listedproduct.validity = customer_account_subscription.validity;
            else
                listedproduct.validity = merchant_account.validity;

            //Changing listedproduct id and approval status wrt to the required scenarios 
            customer_account.approvedmerchants.forEach(element => {
                if(element.merchantid===merchantid)
                    {
                        element.productlistingrequests.forEach(element => {
                            if(element.productid===productid)
                            {
                                requestfound = true;
                                if(element.approvalstatus ===0)
                                    needtoaddproduct = true;
                                element.approvalstatus = requeststatus;
                                if(requeststatus===1)
                                    element.listedproductid = listedproduct._id;
                                else
                                {
                                    if(element.listedproductid!=''&& element.listedproductid!=null)
                                    {
                                        producttoremove =element.listedproductid;
                                    }
                                    element.listedproductid ='';  
                                }
                            }
                        });
                    }
                });
            
            merchant_account.approvedcustomers.forEach(element => {
                if(element.customerid===customerid)
                {                  
                    element.productlistingrequests.forEach(element => {
                    if(element.productid===productid)
                    {
                        requestfound = true;
                        if(element.approvalstatus ===0)
                            needtoaddproduct = true;
                        element.approvalstatus = requeststatus;
                        if(requeststatus==1)
                            element.listedproductid = listedproduct._id;
                        else
                        {
                            if(element.listedproductid!='' && element.listedproductid!=null)
                            {
                                producttoremove =element.listedproductid;
                            }
                            element.listedproductid ='';                           
                        }
                    }
                    });
                }
            });

            if(!requestfound)
                throw("Product listing request not found")    
            

            if(producttoremove!='')
            {
                const previouslistedproduct = await db.Product.findOne({ _id:producttoremove });
                await previouslistedproduct.remove();
            }

            if(requeststatus === 1 && needtoaddproduct)
            {
                await merchant_account.save();
            }
            if(requeststatus === 0)
                await merchant_account.save();
        }
        
        //Saving product only when approval status is 1 and its not a repeating request (made to only work when value of approval status changes from 0 to 1)
        if(requeststatus === 1 && needtoaddproduct)
        {
            await listedproduct.save();
            await customer_account.save();
        }
        if(requeststatus === 0)
        {
            await customer_account.save();
        }
    }
}  

//Get Approved Customers
async function getApprovedCustomers({ merchantid ,ipAddress, origin}) {
  
    //Checking if merchant has subscription
    const merchant_account = await db.Subscription.findOne({ subscriptionuser:merchantid });
    if (merchant_account == null || merchant_account == "") {
        throw("Not a valid merchant")
    }
    else
    {
        const customers = merchant_account.approvedcustomers;
        for(let l=0;l< merchant_account.approvedcustomers.length;l++)
        {
            const invoices = await db.Invoice.find({merchant :merchantid,customer:merchant_account.approvedcustomers[l].customerid});
            merchant_account.approvedcustomers[l].outstanding = 0;
            for(let i=0;i< invoices.length;i++)
                merchant_account.approvedcustomers[l].outstanding += invoices[i].outstanding;
        }
        return customers;
    }
}  

//Get Approved Customers
async function getApprovedMerchants({ customerid ,ipAddress, origin}) {
  
    //Checking if merchant has subscription
    const customer_account = await db.Account.findOne({ _id:customerid });
    if (customer_account == null || customer_account == "") {
        throw("Not a valid customer")
    }
    else
    {
        const merchants = customer_account.approvedmerchants;
        for(let l=0;l< customer_account.approvedmerchants.length;l++)
        {
            const invoices = await db.Invoice.find({merchant :customer_account.approvedmerchants[l].merchantid,customer:customerid});
            customer_account.approvedmerchants[l].outstanding = 0;
            for(let i=0;i< invoices.length;i++)
            customer_account.approvedmerchants[l].outstanding += invoices[i].outstanding;
        }
        return merchants;
    }
}