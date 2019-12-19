'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {

    return queryInterface.createTable(
      'users',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        email: {
          type: Sequelize.STRING,
          unique: true,
        },
        firstname: Sequelize.STRING,
        lastname: Sequelize.STRING,
        telephone: {
          type: Sequelize.STRING,
          allowNull: true
        },
        comment: {
          type: Sequelize.STRING,
          allowNull: true
        },
        register_number: {
          type: Sequelize.STRING,
          allowNull: true
        },
        university: {
          type: Sequelize.STRING,
          allowNull: true
        },
        admin: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        password: {
          type: Sequelize.STRING,
          allowNull: true
        },
        createdAt: {
          type: Sequelize.DATE
        },
        updatedAt: {
          type: Sequelize.DATE
        },
      },
      {
        engine: 'InnoDB',                     // default: 'InnoDB'
        charset: 'latin1',                    // default: null
      }
    )
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('users')
  }
};
