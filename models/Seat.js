"use strict";

module.exports = function (sequelize, DataTypes) {
    var Seat = sequelize.define("seat", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        },
        column: DataTypes.INTEGER,
        row: DataTypes.STRING,
        section: DataTypes.STRING,
        course: DataTypes.STRING,
        state: DataTypes.INTEGER,
        transaction: DataTypes.INTEGER,
        precio: DataTypes.FLOAT,
        name: DataTypes.STRING,
        register_number: DataTypes.STRING,
        university: DataTypes.STRING,
        no_document: DataTypes.STRING,
        order_id: DataTypes.STRING
    });

    return Seat;
};
