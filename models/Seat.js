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
    });

    return Seat;
};
