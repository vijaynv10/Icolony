const config = require('config.json');
const jwt = require('jsonwebtoken');
const db = require('_helpers/db');

module.exports = {
    addProduct,
    editProduct,
    delete: _delete,
    basicDetailsMultipleProducts,
    basicDetailsSingleProduct,
    getProductsOfMerchant,
    getProductsByName,
    addStock,
    removeStock,
    getStock
};

// Add Product
async function addProduct({ productname, category,subcategory,productdetails,hsncode,owner,addedby, ipAddress, origin}) {
    
    const subscriptionofmerchant = await db.Subscription.findOne({subscriptionuser:owner});
    if(subscriptionofmerchant==""||subscriptionofmerchant==null)
        throw 'No subscription found';

    if(DateCheck(subscriptionofmerchant.validity))
    {
        const product = new db.Product();
        product.productname= productname;
        product.category = category;
        product.subcategory = subcategory;
        product.productdetails = productdetails;
        product.hsncode = hsncode;
        product.owner = owner;
        product.addedby = addedby;
        product.createdDTS= Date.now();
        product.lastupdatedIP=ipAddress;
        product.validity = subscriptionofmerchant.validity;
        // save product
        await product.save();
    }
    else
        throw 'Subscription expired';
}

// Edit product
async function editProduct({id, productname, category,subcategory,productdetails,hsncode,owner,addedby, ipAddress, origin}) {
    const subscriptionofmerchant = await db.Subscription.findOne({subscriptionuser:owner});
    if(subscriptionofmerchant==""||subscriptionofmerchant==null)
        throw 'No subscription found';

    if(DateCheck(subscriptionofmerchant.validity))
    {
        const product = await db.Product.findOne({ _id:id });
        product.productname= productname;
        product.category = category;
        product.subcategory = subcategory;
        product.productdetails = productdetails;
        product.hsncode = hsncode;
        product.owner = owner;
        product.addedby = addedby;
        product.createdDTS= Date.now();
        product.lastupdatedIP=ipAddress;
        // save product
        await product.save();
    }
    else
        throw 'Subscription expired';
}

// Add Stock
async function addStock({stockdetails, ipAddress, origin}) {
    //Updating stock if the batchnumbers exist . Else adding as new stock 
    for (let i = 0; i < stockdetails.length; i++) 
    {
        const product = await db.Product.findById(stockdetails[i].productid);
        for (let j = 0; j < product.productdetails.length; j++)
        {
            if(product.productdetails[j]._id==stockdetails[i].variantid)
            {
                var newstock = true;
                for (let k = 0; k < product.productdetails[j].stock.length; k++)
                {
                    if(product.productdetails[j].stock[k].batchnumber == stockdetails[i].batchnumber)
                    {
                        product.productdetails[j].stock[k].stockleft += stockdetails[i].stockquantity;
                        product.productdetails[j].stock[k].updateddate = Date.now();
                        newstock=false;
                    }
                }

                const now = Date.now();
                //Adding new stock and setting expiry to manufactured date + shelf life of variant 
                if(newstock)
                    product.productdetails[j].stock.push({"batchnumber": stockdetails[i].batchnumber, "manufactureddate": stockdetails[i].manufactureddate,"expirydate": stockdetails[i].manufactureddate.addDays(product.productdetails[j].shelflife),"updateddate":now,"stockleft":stockdetails[i].stockquantity});
            }
        }
        await product.save();
    }
}

// Get Stock
async function getStock({product,variant,time,owner, origin}) {
    //Get stock . Filters available with time in months and product id 
    var stocks = new Array();
    if(product =="All")
    {
        const products = await db.Product.find({owner:owner}); 
        for(let i=0;i<products.length;i++)
        {
            for(let j=0;j<products[i].productdetails.length;j++)
            {
                if(variant=="All")
                {
                    for(let k=0;k<products[i].productdetails[j].stock.length;k++)
                    {
                        if(time==0)
                            stocks.push(products[i].productdetails[j].stock[k]);
                        else
                        {
                            if(products[i].productdetails[j].stock[k].updateddate.addMonths(time) > Date.now())
                                stocks.push(products[i].productdetails[j].stock[k]);
                        }
                    }
                }
                else
                {
                    if(products[i].productdetails[j]._id == variant)
                    {
                        for(let k=0;k<products[i].productdetails[j].stock.length;k++)
                        {
                            if(time==0)
                                stocks.push(products[i].productdetails[j].stock[k]);
                            else
                            {
                                if(products[i].productdetails[j].stock[k].updateddate.addMonths(time) > Date.now())
                                    stocks.push(products[i].productdetails[j].stock[k]);
                            }
                        }
                    }
                }
            }
        
        }
    }
    else
    {
        const products = await db.Product.findById(product); 
        for(let j=0;j<products.productdetails.length;j++)
        {
            if(variant=="All")
            {
                for(let k=0;k<products.productdetails[j].stock.length;k++)
                {
                    if(time==0)
                        stocks.push(products.productdetails[j].stock[k]);
                    else
                    {
                        if(products.productdetails[j].stock[k].updateddate.addMonths(time) > Date.now())
                            stocks.push(products.productdetails[j].stock[k]);
                    }
                }
            }
            else
            {

                if(products.productdetails[j]._id == variant)
                {
                    for(let k=0;k<products.productdetails[j].stock.length;k++)
                    {
                        if(time==0)
                            stocks.push(products.productdetails[j].stock[k]);
                        else
                        {
                            if(products.productdetails[j].stock[k].updateddate.addMonths(time) > Date.now())
                                stocks.push(products.productdetails[j].stock[k]);
                        }
                    }
                }
            }      
        }  
    } 
    return {stocks};
}
async function removeStock({stockdetails, ipAddress, origin}) {
    for (let i = 0; i < stockdetails.length; i++) 
    {
        const product = await db.Product.findById(stockdetails[i].productid);
        for (let j = 0; j < product.productdetails.length; j++)
        {
            if(product.productdetails[j]._id==stockdetails[i].variantid)
            {
                for (let k = 0; k < product.productdetails[j].stock.length; k++)
                {
                    if(product.productdetails[j].stock[k].batchnumber == stockdetails[i].batchnumber)
                    {
                        product.productdetails[j].stock[k].stockleft -= stockdetails[i].stockquantity;
                        if(product.productdetails[j].stock[k].stockleft<=0)
                        {
                            product.productdetails[j].stock.splice(k);
                        }
                    }
                }
            }
        }
        await product.save();
    }
} 

// Delete Product
async function _delete(id,owner) {
    const product = await getProduct(id);
    if(product.owner === owner)
        await product.remove();
    else
        throw 'Unauthorized to remove product';
}

// Find product by id
async function getProduct(id) {
    if (!db.isValidId(id)) throw 'Product not found';
    const product = await db.Product.findById(id);
    if (!product) throw 'Product not found';
    return product;
}

// Get products of owner
async function getProductsOfMerchant(requester,merchant) {
    const products = await db.Product.find({owner:merchant});
    if(requester === merchant)
    {
        return  products;
    }
    else
    {
        var showprice = false;
        const subscriptionofmerchant = await db.Subscription.findOne({subscriptionuser:merchant});
        if(subscriptionofmerchant.approvedcustomers==null)
        {
            let basicproductdetails = await basicDetailsMultipleProducts(merchant,requester,products,showprice);
            return  basicproductdetails;
        }
        else
        {   
            subscriptionofmerchant.approvedcustomers.forEach(element => {
            if(element.customerid===requester)
                if(element.approvalstatus === 1)
                    showprice = true;
            });
            let basicproductdetails = await basicDetailsMultipleProducts(merchant,requester,products,showprice);
            return  basicproductdetails;
        }
    }
}

async function basicDetailsMultipleProducts(merchant,requester,products,showprice)
{
    var basicproducts = new Array();
    for (let i = 0; i < products.length; i++) 
    {
        if(DateCheck(products[i].validity))
        {
            let basicproductdetails = await basicDetailsofAProduct(merchant,requester,products[i],showprice);
            basicproducts.push(basicproductdetails);
        }
    }
    return basicproducts;
}

async function basicDetailsSingleProduct(merchant,requester,product,showprice)
{
    var basicproducts = new Array();
    if(DateCheck(product.validity))
        await basicproducts.push(basicDetailsofAProduct(merchant,requester,product,showprice));   
    return basicproducts;
}

async function basicDetailsofAProduct(merchant,requester,product,showprice)
{ 
    var productdetails = new Array();
    for(let i=0;i<product.productdetails.length;i++)
    {   
        if(product.productdetails[i].available)
        {
            let basicproductdetials = await basicDetailsofAProductVariant(merchant,requester,product._id,product.productdetails[i],showprice);
            productdetails.push(basicproductdetials);
        }
    }
    
    const {_id,productname,category,subcategory,hsncode,owner} = product;
    return { _id, productname,productdetails,category,subcategory,owner,hsncode};
}

async function basicDetailsofAProductVariant(merchant,requester,productid,productdetails,showprice)
{
    const {wholesaleprice,discount} = await getPriceAndDiscount(merchant,requester,productid,productdetails);
    const {name,unitvalue,unit,retialprice,cgst,sgst,igst,available,shelflife,size,dimensions,colour,minimumorder} = productdetails;
    if(showprice)
        return {name, unitvalue, unit, wholesaleprice, retialprice, discount,cgst,sgst,igst,available,shelflife,size,dimensions,colour,minimumorder};
    else
        return {name, unitvalue, unit,available,shelflife,size,dimensions,colour,minimumorder};
}
async function getPriceAndDiscount(merchantid,requester,productid,productdetails)
{
    var approvedcustomer = false;
    const subscriptionofmerchant = await db.Subscription.findOne({subscriptionuser:merchantid});
    let wholesaleprice,discount =0;
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
            console.log(merchantid+" "+requester );
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
// Get Products by name 
async function getProductsByName(requester,searchstring) {
    var queryproductsearchname = {productname: {"$regex": ".*"+searchstring+"*.", "$options": "i"} };
    var queryproductsearchcategory = {category: {"$regex": ".*"+searchstring+"*.", "$options": "i"} };
    var queryproductsearchsubcategory = {subcategory: {"$regex": ".*"+searchstring+"*.", "$options": "i"} };
    var queryproductsearchhsncode = {hsncode: {"$regex": ".*"+searchstring+"*.", "$options": "i"} };
    const searchresultfromproductsname = await db.Product.find(queryproductsearchname);
    const searchresultfromproductscategory = await db.Product.find(queryproductsearchcategory);
    const searchresultfromproductssubcategory = await db.Product.find(queryproductsearchsubcategory);
    const searchresultfromproductshsncode = await db.Product.find(queryproductsearchhsncode);
    var searchresult = new Array();
    for (let i = 0; i < searchresultfromproductsname.length; i++) 
    {
        if(DateCheck(searchresultfromproductsname[i].validity) && searchresultfromproductsname[i].available)
        {
            const isapprovedcustomer = await ifApprovedCustomer(requester,searchresultfromproductsname[i].owner);
            searchresult.push(basicDetailsSingleProduct(searchresultfromproductsname[i],isapprovedcustomer));
        }
    }
    for (let i = 0; i < searchresultfromproductscategory.length; i++) 
    {
        if(DateCheck(searchresultfromproductscategory[i].validity) && searchresultfromproductscategory[i].available)
        {
            const isapprovedcustomer = await ifApprovedCustomer(requester,searchresultfromproductscategory[i].owner);
            searchresult.push(basicDetailsSingleProduct(searchresultfromproductscategory[i],isapprovedcustomer));
        }
    }
    for (let i = 0; i < searchresultfromproductssubcategory.length; i++) 
    {
        if(DateCheck(searchresultfromproductssubcategory[i].validity) && searchresultfromproductssubcategory[i].available)
        {
            const isapprovedcustomer = await ifApprovedCustomer(requester,searchresultfromproductssubcategory[i].owner);
            searchresult.push(basicDetailsSingleProduct(searchresultfromproductssubcategory[i],isapprovedcustomer));
        }
    }
    for (let i = 0; i < searchresultfromproductshsncode.length; i++) 
    {
        if(DateCheck(searchresultfromproductshsncode[i].validity) && searchresultfromproductssubcategory[i].available)
        {
            const isapprovedcustomer = await ifApprovedCustomer(requester,searchresultfromproductshsncode[i].owner);
            searchresult.push(basicDetailsSingleProduct(searchresultfromproductshsncode[i],isapprovedcustomer));
        }
    }
    return  {
        searchresult,
    };
}

function DateCheck(validityDate)
{
    if(validityDate>Date.now())
        return true;
    else
        return false;
}

Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}

Date.isLeapYear = function (year) { 
    return (((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0)); 
};

Date.getDaysInMonth = function (year, month) {
    return [31, (Date.isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
};

Date.prototype.isLeapYear = function () { 
    return Date.isLeapYear(this.getFullYear()); 
};

Date.prototype.getDaysInMonth = function () { 
    return Date.getDaysInMonth(this.getFullYear(), this.getMonth());
};

Date.prototype.addMonths = function (value) {
    var n = this.getDate();
    this.setDate(1);
    this.setMonth(this.getMonth() + value);
    this.setDate(Math.min(n, this.getDaysInMonth()));
    return this;
};

async function ifApprovedCustomer(requester,merchant)
{
    if(requester == merchant)
        return true;

    var isapprovedcustomer = false;
    const subscriptionofmerchant = await db.Subscription.findOne({subscriptionuser:merchant});
    if(subscriptionofmerchant.approvedcustomers==null)
    {
        return  isapprovedcustomer;
    }
    else
    {    
        subscriptionofmerchant.approvedcustomers.forEach(element => {
        if(element.customerid===requester)
            if(element.approvalstatus === 1)
                isapprovedcustomer = true;
        });
        return  isapprovedcustomer;
    }
}