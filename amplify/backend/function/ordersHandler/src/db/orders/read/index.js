const { createCart } = require('../create');

module.exports = {
    //getAllProducts: require('./getAllProducts'),
    getOrder: require('./getOrder'),
    getCart: require('./getCart'),
    deleteOrder: require('../delete/deleteOrder'),
    deletCart: require('../delete/deleteCart'),
    createOrder: require('../create/createOrder'),
    createCart: require('../create/createCart'),
    updateOrder: require('../update/updateOrder'),
    updateCart: require('../update/updateCart'),
};
