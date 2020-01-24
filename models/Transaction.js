"use strict";

module.exports = function (sequelize, DataTypes) {
    var Transaction = sequelize.define("transaction", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        },
        user_id: DataTypes.INTEGER,
        order_id: DataTypes.STRING,
        state: DataTypes.INTEGER,
        seats: {
            type: DataTypes.TEXT('long'),
            get: function () {
                var seats = this.getDataValue('seats');
                return JSON.parse(seats);
            },
        },
        transaction: DataTypes.STRING,
        transaction_raw: {
            type: DataTypes.TEXT('long'),
            get: function () {
                var seats = this.getDataValue('transaction_raw');
                return JSON.parse(seats);
            },
        }
    });

    return Transaction;
};
