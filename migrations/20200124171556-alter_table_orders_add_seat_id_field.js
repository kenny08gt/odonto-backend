'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
   return Promise.all(
     [
      queryInterface.removeColumn('orders', 'seats'),
      queryInterface.addColumn(
        'orders',
        'seat_id',
        {
          type: Sequelize.INTEGER,
          references: {
            model: 'seats',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'cascade'
        }
      ),
     ]
   )
  },

  down: (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
   return Promise.all([
     queryInterface.removeColumn('orders', 'seat_id'),
     queryInterface.addColumn('orders', 'seats', Sequelize.STRING)
   ])
  }
};
