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
    usernameVerify,
    signIn,
    forgotPassword,
    validateResetToken,
    resetPassword,
    delete: _delete,
    customPrices
};

// Verify username
async function usernameVerify( username ) {
    //Verifying if useraname exists or not
    const account = await db.Employee.findOne({ username });
    if(account != null && account != "")
    {            
        return {usernamestatus:false};     
    }
    else
    {
        return {usernamestatus:true};
    }

}

// Sign In
async function signIn({ username, password, ipAddress, origin})
{
    const account = await db.Employee.findOne({ username });
    if(account == null || account == ""){
        throw("Username is not valid. Please Add/Edit Employee account details from merchant login");
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
            const owner = account.owner;
            // save account
            await account.save();           
            //  save refresh token
            await refreshToken.save();          
            // return basic details and tokens
            return{
                name,
                owner,
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
        throw("Username is not valid. Please Add/Edit Employee account details from merchant login")
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
    const name = account.name;
    const owner = account.owner;
    
    // save account
    await account.save();
    await refreshToken.save();
    await newRefreshToken.save();

    // generate new jwt
    const jwtToken = await generateJwtToken(account);

    // return basic details and tokens
    return {
        name,
        owner,
        jwtToken,
        refreshToken: newRefreshToken.token,
        expires : refreshToken.expires,
    };
}


// revoke token post token return expire date changes and account logout
async function revokeToken({ token, ipAddress }) {
    const refreshToken = await getRefreshToken(token);

    // revoke token and save
    refreshToken.expires = Date.now();
    
    await refreshToken.save();
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
    const account = await db.Employee.findById(id);
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
