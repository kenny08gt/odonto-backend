"use strict";

module.exports = function (sequelize, DataTypes) {
    var Order = sequelize.define('order', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        },
        user_id: DataTypes.INTEGER,
        transaction_id: DataTypes.INTEGER,
        seat_id: DataTypes.INTEGER,
        uuid: DataTypes.STRING
    })

    return Order;
};
