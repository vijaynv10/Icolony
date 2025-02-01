
const mongoose = require('mongoose');
const connectionOptions = { useCreateIndex: true, useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false };
const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();

async function connectDatabase() {
  //const [version] = await client.accessSecretVersion({
  //    name: 'projects/505977962413/secrets/connectionString/versions/2',
  //  });
    
  // Extract the payload as a string.
  //const payload = version.payload.data.toString();
  const payload = 'mongodb+srv://admin:icolonyadmin@cluster0.alk6s.mongodb.net/IColony?authSource=admin&replicaSet=atlas-tnf54j-shard-0&w=majority&readPreference=primary&appname=MongoDB%20Compass&retryWrites=true&ssl=true'
  mongoose.connect(payload, connectionOptions);
  mongoose.Promise = global.Promise;
}

connectDatabase();

module.exports = {
    Account: require('accounts/account.model'),
    Employee:require('accounts/employee.model'),
    DeliveryPerson:require('accounts/deliveryperson.model'),
    SuperMerchant:require('accounts/supermerchant.model'),
    Subscription: require('accounts/subscription.model'),
    Product:require('products/product.model'),
    RefreshToken: require('accounts/refresh-token.model'),
    Cart: require('ordermanagement/cart.model'),
    Order: require('ordermanagement/order.model'),
    Invoice: require('ordermanagement/invoice.model'),
    CustomPrice:require('products/customprices.model'),
    InvoiceCustomFields:require('ordermanagement/invoicecustomfields.model'),
    CreditNote:require('ordermanagement/creditnote.model'),
    Payment:require('ordermanagement/payment.model'),
    Route:require('delivery/route.model'),
    isValidId,
    connectDatabase
};

function isValidId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}  