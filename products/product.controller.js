const express = require('express');
const router = express.Router();
const Joi = require('joi-oid');
const validateRequest = require('_middleware/validate-request');
const authorize = require('_middleware/authorize')
const Role = require('_helpers/role');
const db = require('_helpers/db');
const productservice = require('./product.service');
var _ = require('underscore');
const multer = require('multer');
const path = require('path');
var fs = require('fs');

var i=0;
const ProductsImageUpload = multer({
    storage: new multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = "ProductImages/" + req.body.productid;
            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir);
            }
            cb(null, dir)
        }, // Destination to store image 
        filename: (req, file, cb) => {
            cb(null, ++i + path.extname(file.originalname))
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



// Routes
router.post('/add-product',authorize(), addProductSchema, addProduct);
router.post('/upload-product-images',authorize(),setIteratortoZero, ProductsImageUpload.array('images', 4), (req, res) => {
    res.send(req.files)
}, (error, req, res, next) => {
    res.status(400).send({ error: error.message })
}) // For Multiple image uplaod
router.post('/edit-product/:id',authorize(), editProductSchema, editProduct);
router.delete('/:id', authorize(), _delete);
router.get('/products-merchant/:merchant', authorize(), getProductsOfMerchant);
router.get('/search/:searchstring', authorize(), getProductsByName);
router.post('/add-stock',authorize(), addStockSchema,addStock);
router.post('/remove-stock',authorize(), removeStockSchema,removeStock);
router.get('/get-stock',authorize(), getStockSchema,getStock);
module.exports = router;

/*
// authorize function --------------------------
function authorizecall(req, res, next) {
    authorize()
    .then(next)
    .catch(() => res.json({ message: 'Unauthorized' })); 
}
*/
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
    console.log("coming here");
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

function addProductSchema(req, res, next) {
    const schema = Joi.object({
        productname: Joi.string().required(),
        category: Joi.string(),
        subcategory: Joi.string(),
        productdetails: Joi.array()
        .items({
            name: Joi.string().required(),
            unitvalue: Joi.number().required(),
            unit: Joi.string().required(),
            wholesaleprice: Joi.number().required(),
            retialprice: Joi.number().required(),
            discount: Joi.number(),
            cgst: Joi.number().required(),
            sgst: Joi.number().required(),
            igst: Joi.number().required(),
            salesnumber: Joi.number(),
            stock: Joi.array()
            .items({
                batchnumber: Joi.string(),
                manufactureddate: Joi.date(),
                stockleft: Joi.number(),
            }),
            available: Joi.boolean(),
            shelflife: Joi.number().required(),
            size: Joi.number(),
            dimensions: Joi.number(),
            colour: Joi.string(),
            minimumorder: Joi.number().required(),
        }),
        hsncode: Joi.string(),
        owner: Joi.string(),
        addedby: Joi.string()
    });
    validateRequest(req, next, schema);
}

// Add Product
async function addProduct(req, res, next) {
    const { productname, category,subcategory,productdetails,hsncode,owner,addedby} = req.body;
    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,owner);
    const ifemployeeandhaspermission = await employeecheck(employeeid,owner,"Products","edit");
    if (owner !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to make the change' });
    }
    productservice.addProduct({ productname,category,subcategory,productdetails,hsncode,owner,addedby, ipAddress })
    .then(() => res.json({ message: 'Product Added' }))
    .catch(next);
} 

function setIteratortoZero(req, res, next) {
    i=0;
    next();
}

function editProductSchema(req, res, next) {
    const schema = Joi.object({
        productname: Joi.string().required(),
        category: Joi.string(),
        subcategory: Joi.string(),
        productdetails: Joi.array()
        .items({
            name: Joi.string().required(),
            unitvalue: Joi.number().required(),
            unit: Joi.string().required(),
            wholesaleprice: Joi.number().required(),
            retialprice: Joi.number().required(),
            discount: Joi.number(),
            cgst: Joi.number().required(),
            sgst: Joi.number().required(),
            igst: Joi.number().required(),
            salesnumber: Joi.number(),
            stock: Joi.array()
            .items({
                batchnumber: Joi.string(),
                manufactureddate: Joi.date(),
                stockleft: Joi.number(),
            }),
            available: Joi.boolean(),
            shelflife: Joi.number().required(),
            size: Joi.number(),
            dimensions: Joi.number(),
            colour: Joi.string(),
            minimumorder: Joi.number().required(),
        }),
        hsncode: Joi.string(),
        owner: Joi.string(),
        addedby: Joi.string(),
    });
    validateRequest(req, next, schema);
}

// Edit Product
async function editProduct(req, res, next) {
    const { productname, category,subcategory,productdetails,hsncode,owner,addedby} = req.body;
    const id = req.params.id;
    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,owner);
    const ifemployeeandhaspermission = await employeecheck(employeeid,owner,"Products","edit");
    if (owner !== req.user.id && !ifemployeeandhaspermission &&!ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to make the change' });
    }
    productservice.editProduct({id, productname,category,subcategory,productdetails,hsncode,owner,addedby, ipAddress })
    .then(() => res.json({ message: 'Product Updated' }))
    .catch(next);
} 


// Delete product
async function _delete(req, res, next) {
    const product = await db.Product.findById(req.params.id);
    if(!product)
        return res.status(401).json({ message: 'Product not found' });
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,product.owner);
    const ifemployeeandhaspermission = await employeecheck(employeeid,product.owner,"Products","edit");
    if (product.owner !== req.user.id && !ifemployeeandhaspermission &&!ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to make the change' });
    }
    productservice.delete(req.params.id,req.user.id)
        .then(() => res.json({ message: 'Product deleted successfully' }))
        .catch(next);
}

// Get Products of Merchant 
function getProductsOfMerchant(req, res, next) {
    productservice.getProductsOfMerchant(req.user.id,req.params.merchant)
        .then(products => products ? res.json(products) : res.sendStatus(404))
        .catch(next);
}

// Get Products by Name 
function getProductsByName(req, res, next) {
    const searchstring = req.params.searchstring;
    productservice.getProductsByName(req.user.id,searchstring)
        .then(products => products ? res.json(products) : res.sendStatus(404))
        .catch(next);
}

function addStockSchema(req, res, next) {
    const schema = Joi.object({
        owner:Joi.string().required(),
        stockdetails: Joi.array()
        .items({
        productid: Joi.string().required(),
        variantid: Joi.string().required(),
        batchnumber: Joi.string().required(),
        manufactureddate: Joi.date().required(),
        stockquantity: Joi.number().required()
        })
    });
    validateRequest(req, next, schema);
}

// Add Stock
async function addStock(req, res, next) {
    const {stockdetails,owner} = req.body;
    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,owner);
    const ifemployeeandhaspermission = await employeecheck(employeeid,owner,"Products","edit");
    //Authorisation for employee accounts do it here
    if (owner !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to make the change' });
    }
    productservice.addStock({stockdetails, ipAddress })
    .then(() => res.json({ message: 'Stock Added' }))
    .catch(next);
} 


function removeStockSchema(req, res, next) {
    const schema = Joi.object({
        owner:Joi.string().required(),
        stockdetails: Joi.array()
        .items({
        productid: Joi.string().required(),
        variantid: Joi.string().required(),
        batchnumber: Joi.string().required(),
        stockquantity: Joi.number().required()
        })
    });
    validateRequest(req, next, schema);
}

// Remove Stock
async function removeStock(req, res, next) {
    const {stockdetails,owner} = req.body;
    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,owner);
    const ifemployeeandhaspermission = await employeecheck(employeeid,owner,"Products","edit");
    if (owner !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to make the change' });
    }
    productservice.removeStock({stockdetails, ipAddress })
    .then(() => res.json({ message: 'Stock Removed' }))
    .catch(next);
} 

function getStockSchema(req, res, next) {
    const schema = Joi.object({
        product:Joi.string().required(),
        variant:Joi.string().required(),
        time: Joi.number().required(),
        owner: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

// Remove Stock
async function getStock(req, res, next) {
    const {product,variant,time,owner} = req.body;
    const ipAddress = req.ip;
    const employeeid = req.user.id;
    const supermerchantid = req.user.id;
    const ifsupermerchant = await supermerchantcheck(supermerchantid,owner);
    const ifemployeeandhaspermission = await employeecheck(employeeid,owner,"Products","view");
    //Authorisation for employee accounts do it here
    if (owner !== req.user.id && !ifemployeeandhaspermission && !ifsupermerchant) {
        return res.status(401).json({ message: 'Unauthorized to get stock' });
    }
    
    productservice.getStock({product,variant,time,owner, ipAddress })
    .then(({ stocks }) => {
        res.json(stocks);
    })
    .catch(next);
} 