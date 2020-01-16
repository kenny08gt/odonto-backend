'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable(
      'orders',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        uuid: Sequelize.STRING,
        user_id: {
          type: Sequelize.INTEGER,
          references: {
            model: 'users',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        },
        seats: Sequelize.STRING,
        transaction_id: {
          type: Sequelize.INTEGER,
          references: {
            model: 'transactions',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
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
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    return queryInterface.dropTable('orders')
  }
};
