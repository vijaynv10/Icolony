# Icolony - B2B ECommerce Platform

Icolony is a robust B2B eCommerce platform designed to streamline business operations with powerful features such as Subscription Management, Delivery Management, Invoicing, Inventory Management, and Order Management. The platform is built on a scalable microservices architecture (MCS) using MongoDB shared clusters and ES6.

## Features

- **Subscription Management**: Manage subscriptions for businesses, including auto-renewals, payment tracking, and plan modifications.
- **Delivery Management**: Track orders and deliveries, manage logistics, and optimize shipping operations.
- **Invoicing**: Automatically generate invoices, track payments, and manage billing cycles.
- **Inventory Management**: Efficiently track product stock levels, updates, and reorder triggers.
- **Order Management**: Seamlessly handle orders, process payments, and track the status of purchases.

## Technologies Used

- **MongoDB**: MongoDB Shared Cluster for scalable data storage and retrieval.
- **MCS Architecture**: Microservices architecture for better scalability, maintainability, and separation of concerns.
- **ES6**: JavaScript ES6 for modern development practices, with async/await, modular imports, and more.
- **Node.js**: Backend built using Node.js for efficient server-side logic.
- **Express.js**: Web framework for building RESTful APIs.

## Folder Structure

The project follows a modular approach to separate different services and features. Here is an overview of the folder structure:

```plaintext
Icolony/
│
├── src/                    # Main source code
│   ├── config/              # Configuration files (e.g., database, environment)
│   ├── services/            # Individual services (e.g., subscription, delivery)
│   │   ├── subscription/    # Subscription management service
│   │   ├── delivery/        # Delivery management service
│   │   ├── invoicing/       # Invoicing management service
│   │   ├── inventory/       # Inventory management service
│   │   └── order/           # Order management service
│   ├── controllers/         # Request handlers for API endpoints
│   ├── models/              # MongoDB models for database interaction
│   ├── routes/              # API routes for handling different services
│   ├── utils/               # Utility functions (e.g., logging, validation)
│   ├── middlewares/         # Express middlewares (e.g., authentication)
│   └── app.js               # Main entry point for the application

