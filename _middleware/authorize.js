const jwt = require('express-jwt');
const { secret } = require('config.json');
const db = require('_helpers/db');
const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();

module.exports = authorize;
//async function authorize(roles = []) {
function authorize(roles = []) {
    //var secret = await getSecret();  
    const secret = 'Q!hfsa2#Dasf@!';
    return [
        // authenticate JWT token and attach user to request object (req.user)
        jwt({secret , algorithms: ['HS256'] }),
        // authorize based on user role
        async (req, res, next) => {
            const account = await db.Account.findById(req.user.id);
            const employee = await db.Employee.findById(req.user.id);
            const supermerchant = await db.SuperMerchant.findById(req.user.id);
            const deliveryperson = await db.DeliveryPerson.findById(req.user.id);
            const refreshTokens = await db.RefreshToken.findById(req.user.id);
            if (!account && !employee && !supermerchant && !deliveryperson) {
                // account no longer exists 
                return res.status(401).json({ message: 'Unauthorized' });
            }

            // authentication and authorization successful
            //req.user.role = account.role;
            req.user.ownsToken = token => !!refreshTokens.find(x => x.token === token);
            next();
        }
    ];
}

async function getSecret()
{
  const [version] =  await client.accessSecretVersion({
        name: 'projects/351818595066/secrets/secret/versions/1',
      });
      return version.payload.data.toString();
}