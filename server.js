require('rootpath')();
const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const cors = require('cors');
const errorHandler = require('_middleware/error-handler');

var corsOptions = {
    origin: 'http://localhost:8080',
    optionsSuccessStatus: 200 // For legacy browser support
}

app.use(express.urlencoded({ extended: false })); 
app.use(express.json()); 
app.use(cookieParser());

// allow cors requests from any origin and with credentials
app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));

// accounts api routes
app.use('/accounts', require('./accounts/accounts.controller'));

// products api routes
app.use('/products', require('./products/product.controller'));

// requests api routes
app.use('/requests', require('./requests/requests.controller'));

// orders api routes
app.use('/orders', require('./ordermanagement/orders.controller'));

// orders api routes
app.use('/employees', require('./accounts/employees.controller'));

// delivery api routes
app.use('/delivery', require('./delivery/delivery.controller'));

// swagger docs route
app.use('/api-docs', require('_helpers/swagger'));

// global error handler
app.use(errorHandler);

// start server
const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 4000;
app.listen(port, () => {
    console.log('Server listening on port ' + port);
});
