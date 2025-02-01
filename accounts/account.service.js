const config = require('config.json');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require("crypto");
const sendEmail = require('_helpers/send-email');
const db = require('_helpers/db');
var uuid = require('uuid');
const { custom } = require('joi');
const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();

module.exports = {
    refreshToken,
    revokeToken,
    superMerchantSignUp,
    superMerchantSignIn,
    mailSignUp,
    usernameVerify,
    updatePersonalDetails,
    mailSignIn,
    updateAddress,
    updateLicenses,
    verifyEmail,
    forgotPassword,
    validateResetToken,
    resetPassword,
    delete: _delete,
    subscribeSeller,
    updateSellerSubscription,
    updateSellerSubscriptionDetails,
    customPrices,
    customInvoiceFields,
    checkCustomPriceValidity,
    checkEmployeesValidity
};

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

// Super Merchant Sign up
async function superMerchantSignUp({ name,shoplimit,shopsinluded,username, password,durationinmonths, ipAddress, origin}) {

    const account = await db.SuperMerchant.findOne({username: username });
    //Check if no account is found with provided username . Only then eligible to create account
    if (account == null || account == "") {
        const account = new db.SuperMerchant();
        account.userid = uuid.v4();
        account.name=name;
        account.shoplimit = shoplimit;
        account.shopsinluded =shopsinluded; 
        account.username = username;
        account.password = hash(password);
        account.accountcreated = Date.now();    
        account.validity = Date.now();
        account.validity.addMonths(durationinmonths);
        // save account
        await account.save();

        // authentication successful so generate jwt and refresh tokens
        const jwtToken = await generateJwtToken(account);
        const refreshToken = generateRefreshToken(account, ipAddress);

        // save refresh token
        await refreshToken.save();

        // return basic details and tokens
        return {
            name,
            jwtToken,
            refreshToken: refreshToken.token,
            expires : refreshToken.expires
        };
    }
    else
    {
        throw("Username is alreay registered . Give another username")
    }
}  

// Super Merchant Sign In
async function superMerchantSignIn({ username, password, ipAddress, origin})
{
    const account = await db.SuperMerchant.findOne({ username });
    if(account == null || account == ""){
        throw("Username is not valid. Please Sign Up.");
    }

    if (account.username===username) 
    {
        if(bcrypt.compareSync(password, account.password))
        {
            // authentication successful so generate jwt and refresh tokens
            const jwtToken =await generateJwtToken(account);
            const refreshToken = generateRefreshToken(account, ipAddress);
            account.lastlogintime= Date.now();
            account.lastloginip = ipAddress;
            const name = account.name;
            // save account
            await account.save();           
            //  save refresh token
            await refreshToken.save();          
            // return basic details and tokens
            return{
                name,
                jwtToken,
                refreshToken: refreshToken.token,
                expires : refreshToken.expires
            };
        }
        else
        {
            throw("Password Incorrect. Please Enter the Correct Password.")
        }   
    }
    else
    {
        throw("Username is not valid. Please Sign Up.")
    }
}

// Sign up
async function mailSignUp({ name,shopname,shoptype,username, password,mobilenumber,email, ipAddress, origin}) {

    const account = await db.Account.findOne({ username });
    //Check if no account is found with provided username . Only then eligible to create account
    if (account == null || account == "") {
        const account = new db.Account();
        account.userid = uuid.v4();
        account.name=name;
        account.shopname = shopname;
        account.shoptype =shoptype; 
        account.username = username;
        account.email= email;
        account.emvstatus= 0;
        account.verificationtoken = randomTokenString();
        account.password = hash(password);
        account.mobilenumber = mobilenumber;
        account.accountcreated = Date.now();
        account.lastloginip = ipAddress;
        account.lastlogintime = Date.now();
        // save account
        await account.save();

        // authentication successful so generate jwt and refresh tokens
        const jwtToken = await generateJwtToken(account);
        const refreshToken = generateRefreshToken(account, ipAddress);

        // save refresh token
        await refreshToken.save();
        
         // send email
        await sendVerificationEmail(account, origin);

        // return basic details and tokens
        return {
            ...BasicDetailsAccount(account),
            jwtToken,
            refreshToken: refreshToken.token,
            expires : refreshToken.expires,
            addressstatus:false,
            compulsorylicensestatus:false,
            optionallicensestatus:false
        };
    }
    else
    {
        throw("Username is alreay registered . Give another username")
    }
}  

// Verify username
async function usernameVerify( username ) {
    //Verifying if useraname exists or not
    const account = await db.Account.findOne({ username });
    if(account != null && account != "")
    {            
        return {usernamestatus:false};     
    }
    else
    {
        return {usernamestatus:true};
    }

}

//Update personal details
async function updatePersonalDetails({id,  name, shopname,shoptype,username , ipAddress, origin})
{
    var account = await db.Account.findOne({ username });
    if(account != null && account != "")
    {
        //Checking if no other accounts have new suggested username
        if(account.id!=id)
            throw("Username is alreay registered . Give another username");
    }
    account = await getAccount(id);
    if(account == null || account == ""){
        throw("ID is not valid");
    }
    if (account.id===id) 
    {
        account.name = name;
        account.shopname = shopname;
        account.shoptype = shoptype;
        account.username = username;
        account.lastloginip = ipAddress;
        account.accountupdated = Date.now();
        await account.save();
    }
}

// Sign In
async function mailSignIn({ username, password, ipAddress, origin})
{
    const account = await db.Account.findOne({ username });
    if(account == null || account == ""){
        throw("Username is not valid. Please Sign Up.");
    }

    if (account.username===username) 
    {
        if(bcrypt.compareSync(password, account.password))
        {
            // authentication successful so generate jwt and refresh tokens
            const jwtToken =await generateJwtToken(account);
            const refreshToken = generateRefreshToken(account, ipAddress);
            account.lastlogintime= Date.now();
            account.lastloginip = ipAddress;
            let addressstatus = true;
            let compulsorylicensestatus=true;
            let optionallicensestatus=true;
            if(!account.billingaddress || !account.shippingaddress)
                addressstatus = false;
            if(!account.gstin || !account.pan || !account.fssai)
                compulsorylicensestatus = false;
            if(account.customlicenses.length==0)
                optionallicensestatus = false;
            // save account
            await account.save();
            
            //  save refresh token
            await refreshToken.save();
            
            // return basic details and tokens
            return{
                ...BasicDetailsAccount(account),
                jwtToken,
                refreshToken: refreshToken.token,
                expires : refreshToken.expires,
                addressstatus:addressstatus,
                compulsorylicensestatus:compulsorylicensestatus,
                optionallicensestatus:optionallicensestatus
            };
        }
        else
        {
            throw("Password Incorrect. Please Enter the Correct Password.")
        }   
    }
    else
    {
        throw("Username is not valid. Please Sign Up.")
    }
}

// Updating address
async function updateAddress({id, type, address, ipAddress, origin})
{
    const account = await getAccount(id);
    if(account == null || account == ""){
        throw("ID is not valid");
    }
    if (account.id===id) 
    {

        if(type === "billing")
        {
            account.billingaddress=address;
        }
        if(type === "shipping")
        {
            account.shippingaddress = address;
        }
        await account.save();
    }
}

// Updating licenses
async function updateLicenses({id, gstin, pan,fssai,customlicenses, ipAddress, origin})
{
    const account = await getAccount(id);
    if(account == null || account == ""){
        throw("ID is not valid");
    }
    if (account.id===id) 
    {
        account.gstin = gstin;
        account.pan = pan;
        account.fssai = fssai;
        account.customlicenses = customlicenses;
        await account.save();
    }
}

// refresh token post id and token return value - generate new jwt
async function refreshToken({ id, token, ipAddress }) {
    const refreshToken = await getRefreshToken(token);
    const account = await getAccount(id);

    // replace old refresh token with a new one and save
    const newRefreshToken = generateRefreshToken(account, ipAddress);
    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;
    refreshToken.replacedByToken = newRefreshToken.token;
    account.lastLoginTime= Date.now();
    let addressstatus = true;
    let compulsorylicensestatus=true;
    let optionallicensestatus=true;
    if(!account.billingaddress || !account.shippingaddress)
        addressstatus = false;
    if(!account.gstin || !account.pan || !account.fssai)
        compulsorylicensestatus = false;
    if(account.customlicenses.length==0)
        optionallicensestatus = false;

    // save account
    await account.save();
    await refreshToken.save();
    await newRefreshToken.save();

    // generate new jwt
    const jwtToken = await generateJwtToken(account);

    // return basic details and tokens
    return {
        ...BasicDetailsAccount(account),
        jwtToken,
        refreshToken: newRefreshToken.token,
        expires : refreshToken.expires,
        addressstatus:addressstatus,
        compulsorylicensestatus:compulsorylicensestatus,
        optionallicensestatus:optionallicensestatus
    };
}


// verifyEmail send token for mail comfirmation
async function verifyEmail( token ) {
    const account = await db.Account.findOne({ verificationtoken: token });
    if (!account) throw 'Verification failed';

    account.emvstatus = 1;
    account.verificationtoken = undefined;
    await account.save();
}

// forgot password send mail token for reset password
async function forgotPassword({ email }, origin) {
    const account = await db.Account.findOne({ email });

    if (!account) throw 'Email is not valid, please enter correct email';

    // create reset token that expires after 24 hours
    account.resetToken = {
        token: randomTokenString(),
        expires: new Date(Date.now() + 24*60*60*1000)
    };
    await account.save();

    // send email
    await sendPasswordResetEmail(account, origin);
}

async function validateResetToken({ token }) {
    const account = await db.Account.findOne({
        'resetToken.token': token,
        'resetToken.expires': { $gt: Date.now() }
    });

    if (!account) throw 'Invalid token';
}

// reset password post token, new password and confirm password
async function resetPassword({ token, password }) {
    const account = await db.Account.findOne({
        'resetToken.token': token,
        'resetToken.expires': { $gt: Date.now() }
    });

    if (!account) throw 'Invalid token';

    // update password and remove reset token
    account.passwordHash = hash(password);
    account.passwordReset = Date.now();
    account.resetToken = undefined;
    await account.save();
}


////// date time convert function
function convertUTCDateToLocalDate(date) {

    date = new Date(date);

    var localOffset = date.getTimezoneOffset() * 60000;

    var localTime = date.getTime();

    date = localTime - localOffset;

    return date;

    };



// delete function
async function _delete(id) {
    const account = await getAccount(id);
    await account.remove();
}

// get account by id
async function getAccount(id) {
    if (!db.isValidId(id)) throw 'Account not found';
    const account = await db.Account.findById(id);
    if (!account) throw 'Account not found';
    return account;
}

//get refresh token 
async function getRefreshToken(token) {
    const refreshToken = await db.RefreshToken.findOne({token}).populate('refreshToken');
    if (!refreshToken || !refreshToken.isActive) throw 'Invalid token';
    return refreshToken;
}

function hash(password) {
    return bcrypt.hashSync(password, 10);
}

async function generateJwtToken(account) {
    //const [version] = await client.accessSecretVersion({
    //    name: 'projects/505977962413/secrets/secret/versions/1',
    //  });
      
    // Extract the payload as a string.
    //const payload = version.payload.data.toString();
    // create a jwt token containing the account id that expires in 15 minutes
    const secret = 'Q!hfsa2#Dasf@!';
    //return jwt.sign({ sub: account.id, id: account.id }, payload , { expiresIn: '15m' });
    return jwt.sign({ sub: account.id, id: account.id }, secret , { expiresIn: '15m' });
}

// generate refresh token ----------------------------
function generateRefreshToken(account, ipAddress) {
    // create a refresh token that expires in 7 days
    return new db.RefreshToken({
        account: account.id,
        token: randomTokenString(),
        expires: new Date(Date.now() + 7*24*60*60*1000),
        createdByIp: ipAddress
    });
}

function randomTokenString() {
    return crypto.randomBytes(40).toString('hex');
}

// get details for user accout-------------------------------------
function BasicDetailsAccount(account) {
    const { id, userid, name, shopname, shoptype, username, mobilenumber, email } = account;
    return { id, userid, name, shopname, shoptype, username, mobilenumber, email};
}

// get details for user accout-------------------------------------
function BasicDetailsSubscription(subscription) {
    const { id, subscriptionuser,acceptordertill,productlimit, employeelimit,customprices,custompricesvalidity,employeeaccounts,defaultreturnvalidity,orderprocessingtime,invoiceconditions,fooddeclaration,categoriessold,onlinepaymentsallowed,deliverablepincodes,validity } = subscription;
    return { id, subscriptionuser,acceptordertill,productlimit, employeelimit,customprices,custompricesvalidity,employeeaccounts,defaultreturnvalidity,orderprocessingtime,invoiceconditions,fooddeclaration,categoriessold,onlinepaymentsallowed,deliverablepincodes,validity};
}

async function sendVerificationEmail(account, origin) {
    let message;
    if (origin) {
        const verifyUrl = `${origin}/accounts/verify-email/${account.verificationtoken}`;
        message = `<p>Please click the below link to verify your email address:</p>
                   <p><a href="${verifyUrl}">${verifyUrl}</a></p>`;
    } else {
        const verifyUrl = `http://icolony-326518.el.r.appspot.com/accounts/verify-email/${account.verificationtoken}`;
        message = `<p>Please use the below token to verify your email address with the <code>/account/verify-email</code> api route:</p>
                    <p><a href="${verifyUrl}">${verifyUrl}</a></p>`;
    }
    // <p><code>${account.verificationtoken}</code></p>`;
    await sendEmail({
        to: account.email,
        subject: 'Sign-up Verification API - Verify Email',
        html: `<h4>Verify Email</h4>
               <p>Thanks for registering!</p>
               ${message}`
    });
}

async function sendAlreadyRegisteredEmail(email, origin) {
    let message;
    if (origin) {
        message = `<p>If you don't know your password please visit the <a href="${origin}/account/forgot-password">forgot password</a> page.</p>`;
    } else {
        message = `<p>If you don't know your password you can reset it via the <code>/account/forgot-password</code> api route.</p>`;
    }

    await sendEmail({
        to: email,
        subject: 'Sign-up Verification API - Email Already Registered',
        html: `<h4>Email Already Registered</h4>
               <p>Your email <strong>${email}</strong> is already registered.</p>
               ${message}`
    });
}

async function sendPasswordResetEmail(account, origin) {
    let message;
    if (origin) {
        const resetUrl = `${origin}/account/reset-password?token=${account.resetToken.token}`;
        message = `<p>Please click the below link to reset your password, the link will be valid for 1 day:</p>
                   <p><a href="${resetUrl}">${resetUrl}</a></p>`;
    } else {
        message = `<p>Please use the below token to reset your password with the <code>/account/reset-password</code> api route:</p>
                   <p><code>${account.resetToken.token}</code></p>`;
    }

    await sendEmail({
        to: account.email,
        subject: 'Sign-up Verification API - Reset Password',
        html: `<h4>Reset Password Email</h4>
               ${message}`
    });
}

// Verify username for Employee
async function usernameVerifyEmployee( username ) {
    //Verifying if useraname exists or not
    const account = await db.Employee.findOne({username : username });
    if(account != null && account != "")
    {            
        return false;     
    }
    else
    {
        return true;
    }
}

// Verify username for Delivery Person
async function usernameVerifyDelivery( username ) {
    //Verifying if useraname exists or not
    const account = await db.DeliveryPerson.findOne({username : username });
    if(account != null && account != "")
    {            
        return false;     
    }
    else
    {
        return true;
    }
}

// subscribe as seller
async function subscribeSeller({ subscriptionuser,acceptordertill,productlimit,customprices,delivery,deliverydurationinmonths,custompricesdurationinmonths, employeelimit,employeeaccounts,deliveryaccounts,defaultcreditlimit,defaultreturnvalidity,orderprocessingtime,invoiceprefixstring,lastinvoicenumber,invoiceresetdate,invoiceconditions,fooddeclaration,categoriessold,onlinepaymentsallowed,deliverablepincodes,durationinmonths, ipAddress, origin}) {

    const account = await db.Account.findOne({ _id:subscriptionuser });
    if (account != null && account != "") {
        //Checking if already a seller . A seller will have option only to update subscription using updateSellerSubscription route
        if(account.subscriptions.indexOf('seller') != -1)
            throw("Already a seller")

        const subscription = new db.Subscription(); 
        subscription.subscriptionuser = subscriptionuser;
        subscription.productlimit = productlimit;
        subscription.customprices = customprices;
        subscription.delivery = delivery;
        subscription.acceptordertill = acceptordertill;
        subscription.employeelimit = employeelimit;
        subscription.defaultcreditlimit = defaultcreditlimit;
        subscription.defaultreturnvalidity = defaultreturnvalidity;
        subscription.orderprocessingtime = orderprocessingtime;
        subscription.invoiceprefixstring = invoiceprefixstring;
        subscription.lastinvoicenumber = lastinvoicenumber;
        subscription.invoiceresetdate = invoiceresetdate;
        subscription.invoiceconditions = invoiceconditions;
        subscription.fooddeclaration = fooddeclaration;
        subscription.categoriessold = categoriessold;
        subscription.onlinepaymentsallowed = onlinepaymentsallowed;
        subscription.deliverablepincodes = deliverablepincodes;
        subscription.validity = Date.now();
        subscription.validity.setMonth(subscription.validity.getMonth()+durationinmonths);
        subscription.custompricesvalidity = Date.now();
        subscription.custompricesvalidity.setMonth(subscription.custompricesvalidity.getMonth()+custompricesdurationinmonths);
        subscription.deliveryvalidity = Date.now();
        subscription.deliveryvalidity.setMonth(subscription.deliveryvalidity.getMonth()+deliverydurationinmonths);
        account.subscriptions.push("seller");
        if(customprices)
        if(account.subscriptions.indexOf('customprices') == -1)
            account.subscriptions.push("customprices");
        if(delivery)
        if(account.subscriptions.indexOf('delivery') == -1)
            account.subscriptions.push("delivery");


        for(let i=0;i<employeeaccounts.length;i++)
        {
            const employee = new db.Employee();
            employee.owner = subscriptionuser;
            employee.name = employeeaccounts[i].employeename;
            employee.username = employeeaccounts[i].username;
            employee.password = hash(employeeaccounts[i].password);
            employee.permissions = employeeaccounts[i].permissions;
            employee.accountcreated = Date.now();
            employee.validity = Date.now();
            employee.validity.addMonths(employeeaccounts[i].durationinmonths);
            await employee.save();
            subscription.employeeaccounts.push(employee._id);
        }

        for(let i=0;i<deliveryaccounts.length;i++)
        {
            const deliveryperson = new db.DeliveryPerson();
            deliveryperson.owner = subscriptionuser;
            deliveryperson.name = deliveryaccounts[i].employeename;
            deliveryperson.username = deliveryaccounts[i].username;
            deliveryperson.password = hash(deliveryaccounts[i].password);
            deliveryperson.routeassigned = deliveryaccounts[i].routeassigned;
            deliveryperson.accountcreated = Date.now();
            deliveryperson.validity = Date.now();
            deliveryperson.validity.addMonths(deliveryaccounts[i].durationinmonths);
            await deliveryperson.save();
            subscription.deliveryaccounts.push(deliveryaccounts._id);
        }

        await subscription.save();
        await account.save();

        // return basic details and tokens
        return {
            ...BasicDetailsSubscription(subscription)
        };
    }
    else
    {
        throw("Account not valid . Please login")
    }
}  

//update seller subscription 
async function updateSellerSubscription({ subscriptionuser,customprices,delivery,deliverydurationinmonths,custompricesdurationinmonths,productlimit,employeelimit,durationinmonths,employeeaccounts,deliveryaccounts})
{
    const subscription = await db.Subscription.findOne({ subscriptionuser:subscriptionuser });
    const account = await db.Account.findOne({ _id:subscriptionuser });
    
    if(customprices)
    if(account.subscriptions.indexOf('customprices') == -1)
        account.subscriptions.push("customprices");
    if(delivery)
    if(account.subscriptions.indexOf('delivery') == -1)
        account.subscriptions.push("delivery");

    subscription.productlimit = productlimit;
    subscription.employeelimit = employeelimit;
    subscription.customprices = customprices;
    subscription.delivery = delivery;

    if(subscription.custompricesvalidity>Date.now())
    {
        var date = new Date(subscription.custompricesvalidity);
        date = date.addMonths(custompricesdurationinmonths);
        subscription.custompricesvalidity = date; 
    }
    else
    {
        subscription.custompricesvalidity = new Date(Date.now());
        subscription.custompricesvalidity.addMonths(custompricesdurationinmonths);
    } 

    if(subscription.deliveryvalidity>Date.now())
    {
        var date = new Date(subscription.deliveryvalidity);
        date = date.addMonths(deliverydurationinmonths);
        subscription.deliveryvalidity = date; 
    }
    else
    {
        subscription.deliveryvalidity = new Date(Date.now());
        subscription.deliveryvalidity.addMonths(deliverydurationinmonths);
    } 

    if(subscription.validity>Date.now())
    {
        var date = new Date(subscription.validity);
        date = date.addMonths(durationinmonths);
        subscription.validity = date; 
    }
    else
    {
        subscription.validity = new Date(Date.now());
        subscription.validity.addMonths(durationinmonths);
    } 

    //Update validity of every product owned and listed by the subscriber
    const products = await db.Product.find({owner:subscriptionuser});
    const productslist2 = await db.Product.find({listedby:subscriptionuser});

    if(products!=null)
        await asyncForEach(products,subscription);
    if(productslist2!=null)    
        await asyncForEach(productslist2,subscription);
    
    if(employeeaccounts)
    for(let i=0;i<employeeaccounts.length;i++)
    {   
        const usernameunique = await usernameVerifyEmployee(employeeaccounts[i].username)
        if(!usernameunique)
        {      
            if(db.isValidId(employeeaccounts[i].employeeid))
            {     
                const employee = await db.Employee.findOne({ _id:employeeaccounts[i].employeeid });
                if(!employee)
                    throw 'Employee does not exist';
                if(employee.username != employeeaccounts[i].username)
                    throw 'Username Exists . Please provide a new one';
            }
            else
            {
                if(employee.username != employeeaccounts[i].username)
                throw 'Username Exists . Please provide a new one';
            }
        }
        if(db.isValidId(employeeaccounts[i].employeeid))
        {
            const employee = await db.Employee.findOne({ _id:employeeaccounts[i].employeeid });
            if(employee)
            {
                employee.name = employeeaccounts[i].employeename;
                employee.username = employeeaccounts[i].username;
                employee.password = hash(employeeaccounts[i].password);
                employee.permissions = employeeaccounts[i].permissions;
                employee.accountupdated = Date.now();
                if(employee.validity>Date.now())
                {
                    var date = new Date(employee.validity);
                    date = date.addMonths(employeeaccounts[i].durationinmonths);
                    employee.validity = date; 
                }
                else
                {
                    employee.validity = new Date(Date.now());
                    employee.validity.addMonths(employeeaccounts[i].durationinmonths);
                } 
                await employee.save();
            }  
            else
            {
                throw 'Employee not found';
            }
        }
        else
        {
            const employee = new db.Employee();
            employee.owner = subscriptionuser;
            employee.name = employeeaccounts[i].employeename;
            employee.username = employeeaccounts[i].username;
            employee.password = hash(employeeaccounts[i].password);
            employee.permissions = employeeaccounts[i].permissions;
            employee.accountcreated = Date.now();
            employee.validity = Date.now();
            employee.validity.addMonths(employeeaccounts[i].durationinmonths);
            await employee.save();
            subscription.employeeaccounts.push(employee._id);
        }
    }

    if(deliveryaccounts)
    for(let i=0;i<deliveryaccounts.length;i++)
    {   
        const usernameunique = await usernameVerifyDelivery(deliveryaccounts[i].username)
        if(!usernameunique)
        {      
            if(db.isValidId(deliveryaccounts[i].employeeid))
            {     
                const deliveryperson = await db.DeliveryPerson.findOne({ _id:deliveryaccounts[i].employeeid });
                if(!deliveryperson)
                    throw 'Employee does not exist';
                if(deliveryperson.username != deliveryaccounts[i].username)
                    throw 'Username Exists . Please provide a new one';
            }
            else
            {
                if(deliveryperson.username != deliveryaccounts[i].username)
                throw 'Username Exists . Please provide a new one';
            }
        }
        if(db.isValidId(deliveryaccounts[i].employeeid))
        {
            const deliveryperson = await db.DeliveryPerson.findOne({ _id:deliveryaccounts[i].employeeid });
            if(deliveryperson)
            {
                deliveryperson.name = deliveryaccounts[i].employeename;
                deliveryperson.username = deliveryaccounts[i].username;
                deliveryperson.password = hash(deliveryaccounts[i].password);
                deliveryperson.routeassigned = deliveryaccounts[i].routeassigned;
                deliveryperson.accountupdated = Date.now();
                if(deliveryperson.validity>Date.now())
                {
                    var date = new Date(deliveryperson.validity);
                    date = date.addMonths(deliveryaccounts[i].durationinmonths);
                    deliveryperson.validity = date; 
                }
                else
                {
                    deliveryperson.validity = new Date(Date.now());
                    deliveryperson.validity.addMonths(deliveryaccounts[i].durationinmonths);
                } 
                await deliveryperson.save();
            }  
            else
            {
                throw 'Delivery person not found';
            }
        }
        else
        {
            const deliveryperson = new db.DeliveryPerson();
            deliveryperson.owner = subscriptionuser;
            deliveryperson.name = deliveryaccounts[i].employeename;
            deliveryperson.username = deliveryaccounts[i].username;
            deliveryperson.password = hash(deliveryaccounts[i].password);
            deliveryperson.routeassigned = deliveryaccounts[i].routeassigned;
            deliveryperson.accountcreated = Date.now();
            deliveryperson.validity = Date.now();
            deliveryperson.validity.addMonths(deliveryaccounts[i].durationinmonths);
            await deliveryperson.save();
            subscription.deliveryaccounts.push(deliveryperson._id);
        }
    }

    await subscription.save();
    await account.save();
}

async function asyncForEach(products,subscription) {
    
    for (let index = 0; index < products.length; index++) {
        if(products[index].listedby!='' && products[index].listedby!=null)
        {
            if(products[index].listedby !=subscription.subscriptionuser)
            {
                const lister = await db.Subscription.findOne({subscriptionuser:products[index].listedby});
                if(lister.validity<subscription.validity)
                    products[index].validity = lister.validity;
                else    
                    products[index].validity = subscription.validity;

            } 
            else
            {
                const owner = await db.Subscription.findOne({subscriptionuser:products[index].owner});
                if(owner.validity<subscription.validity)
                    products[index].validity = owner.validity;
                else    
                    products[index].validity = subscription.validity;
            }
        }
        else
            products[index].validity = subscription.validity;
        await products[index].save();
    }
}

//update seller subscription detials
async function updateSellerSubscriptionDetails({subscriptionuser,acceptordertill,defaultcreditlimit,defaultreturnvalidity,orderprocessingtime,invoiceprefixstring,lastinvoicenumber,invoiceresetdate,invoiceconditions,fooddeclaration,categoriessold,onlinepaymentsallowed,deliverablepincodes})
{
    const subscription = await db.Subscription.findOne({ subscriptionuser:subscriptionuser });
    if(acceptordertill)
        subscription.acceptordertill = acceptordertill;
    if(defaultcreditlimit)
        subscription.defaultcreditlimit = defaultcreditlimit;
    if(defaultreturnvalidity)
        subscription.defaultreturnvalidity = defaultreturnvalidity;
    if(orderprocessingtime)
        subscription.orderprocessingtime = orderprocessingtime;
    if(invoiceprefixstring)
        subscription.invoiceprefixstring = invoiceprefixstring;
    if(lastinvoicenumber)
        subscription.lastinvoicenumber = lastinvoicenumber;
    if(invoiceresetdate)
        subscription.invoiceresetdate = invoiceresetdate;
    if(invoiceconditions)
        subscription.invoiceconditions = invoiceconditions;
    if(fooddeclaration)
        subscription.fooddeclaration = fooddeclaration;
    if(categoriessold)
        subscription.categoriessold = categoriessold;
    if(onlinepaymentsallowed)
        subscription.onlinepaymentsallowed = onlinepaymentsallowed;
    if(deliverablepincodes)
        subscription.deliverablepincodes = deliverablepincodes;


    await subscription.save();
}

//Update Custom Prices 
async function customPrices({merchantid,customerid,productprices})
{
    var approvedcustomer = false;
    const subscriptionofmerchant = await db.Subscription.findOne({subscriptionuser:merchantid});
    if(!subscriptionofmerchant)
        throw 'Merchant doesnt have seller subscription';
    if(subscriptionofmerchant.validity< Date.now())
        throw 'Merchant\'s seller subscription has expired';
    if(!subscriptionofmerchant.customprices)
        throw 'Merchant doesnt have custom prices subscription';
    if(subscriptionofmerchant.approvedcustomers==null)
    {
        throw 'Customer is not an approved customer of the merchant'
    }
    else
    {    
        subscriptionofmerchant.approvedcustomers.forEach(element => {
        if(element.customerid===customerid)
            if(element.approvalstatus === 1)
            approvedcustomer = true;
        });
        if(!approvedcustomer)
            throw 'Customer is not an approved customer of the merchant'
        else
        {
            let customprice = await db.CustomPrice.findOne({merchantid:merchantid,customerid:customerid});
            if(!customprice)
            {
                customprice = new db.CustomPrice(); 
            }
            customprice.merchantid = merchantid;
            customprice.customerid = customerid;
            customprice.productprices = productprices;  
            await customprice.save();
        }
    }  
}

//Update Custom Prices 
async function customInvoiceFields({merchantid,customfields})
{
    const subscriptionofmerchant = await db.Subscription.findOne({subscriptionuser:merchantid});
    if(!subscriptionofmerchant)
        throw 'Merchant doesnt have seller subscription';
    if(subscriptionofmerchant.validity< Date.now())
        throw 'Merchant\'s seller subscription has expired';
    
    let custominvoicefields = await db.InvoiceCustomFields.findOne({merchantid:merchantid});
    if(!custominvoicefields)
    {
        custominvoicefields = new db.InvoiceCustomFields(); 
    }
    custominvoicefields.merchant = merchantid;
    custominvoicefields.customfields = customfields; 
    await custominvoicefields.save(); 
}


//Update Custom Prices 
async function checkCustomPriceValidity({merchantid})
{
    const subscriptionofmerchant = await db.Subscription.findOne({subscriptionuser:merchantid});
    if(!subscriptionofmerchant)
        throw 'Merchant doesnt have seller subscription';
    if(subscriptionofmerchant.validity< Date.now())
        throw 'Merchant\'s seller subscription has expired';

    const monthsleft = differenceInMonths(new Date(subscriptionofmerchant.custompricesvalidity),new Date(Date.now()));
    const maxextensionpossible = differenceInMonths(new Date(subscriptionofmerchant.validity),new Date(subscriptionofmerchant.custompricesvalidity));
    return{
        monthsleft:monthsleft,
        maxextensionpossible:maxextensionpossible
    };
}

//Update Custom Prices 
async function checkEmployeesValidity({merchantid})
{
    const subscriptionofmerchant = await db.Subscription.findOne({subscriptionuser:merchantid});
    if(!subscriptionofmerchant)
        throw 'Merchant doesnt have seller subscription';
    if(subscriptionofmerchant.validity< Date.now())
        throw 'Merchant\'s seller subscription has expired';

    let employeesvalidity = new Array();
    if(subscriptionofmerchant.employeeaccounts)
    for (let index = 0; index < subscriptionofmerchant.employeeaccounts.length; index++) 
    {          
        const employeeaccount = await db.Employee.findOne({_id:subscriptionofmerchant.employeeaccounts[index]});
        const monthsleft = differenceInMonths(new Date(employeeaccount.validity),new Date(Date.now()));
        const maxextensionpossible = differenceInMonths(new Date(subscriptionofmerchant.validity),new Date(employeeaccount.validity));
        employeesvalidity.push({monthsleft:monthsleft,maxextensionpossible:maxextensionpossible});
    }
    
    return employeesvalidity;
}

function differenceInMonths(date1,date2)
{
    var Difference_In_Time = date1.getTime() - date2.getTime();
    // To calculate the no. of days between two dates
    var DifferenceInMonths = Difference_In_Time / (1000 * 3600 * 24 * 30);
    return DifferenceInMonths;
}

