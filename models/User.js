"use strict";

module.exports = function (sequelize, DataTypes) {
    var User = sequelize.define("user", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        },
        email: {
            type: DataTypes.STRING,
            validate: {
                isEmail: true,
            }
        },
        firstname: DataTypes.STRING,
        lastname: DataTypes.STRING,
        telephone: DataTypes.STRING,
        comment: DataTypes.STRING,
        register_number: DataTypes.STRING,
        university: DataTypes.STRING,
        password: DataTypes.STRING,
        admin: DataTypes.BOOLEAN
    });

    return User;
};

