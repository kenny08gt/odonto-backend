require('dotenv').config();

const express = require('express');
const http = require("http");
const path = require('path');
const socketIo = require("socket.io");
const axios = require("axios");
const index = require("./routes/index");
const { Sequelize, Model, DataTypes } = require('sequelize');
//const sequelize = require("./connection");
const app = express();
const port = process.env.PORT || 4001;
// app.use(index);

var fs = require('fs');
var https = require('https');
var privateKey  = fs.readFileSync('odontologiaindependiente.key', 'utf8').toString();
var certificate = fs.readFileSync('cert.crt', 'utf8').toString();
var dad = fs.readFileSync('bundle.crt', 'utf8').toString();
var credentials = {key: privateKey, cert: certificate, ca: dad};
console.log(credentials)
var sequelize = new Sequelize(process.env.DB_DATABASE, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    dialect: 'mysql',

    pool: {
        max: 5,
        min: 0,
        idle: 10000
    },
});
let Seat = require("./models/Seat")(sequelize, DataTypes);

Array.prototype.insert = function (index, item) {
    this.splice(index, 0, item);
};

app.use(express.static(path.join(__dirname + '/frontend/', 'build')));
app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname + '/frontend/', 'build', 'index.html'));
});
//app.listen(9000);
var httpsServer = https.createServer(credentials, app);
httpsServer.listen(9001);
const server = http.createServer(app);
const io = socketIo(server);
let users = [];

const noticeUserConnected = async socket => {
    try {
        console.log('users ' + users.length);
        users.forEach(function (element, i) {
            // console.log(element);
            element.emit("userConected", users.length);
        });
    } catch (error) {
        console.error(`Error: ${error.code}`);
    }
};

const seatModified = async data => {
    try {
        console.log('users ' + users.length);
        users.forEach(function (element, i) {
            // console.log(element);
            //            element.emit("userConected", users.length);
            element.emit('newSeatModified', data);
        });
    } catch (error) {
        console.error(`Error: ${error.code}`);
    }
}

io.on("connection", socket => {
    let address = socket.handshake.address;
    console.log("New client connected " + socket.id + ", ip: " + address);

    users.push(socket);
    noticeUserConnected(socket);

    socket.on("disconnect", () => {
        deleteUser(socket);
        console.log("Client disconnected " + socket.id);
        noticeUserConnected();
    });

    socket.on('connected', function (data, callback) {
        console.log('connected from frontend');
        let seats = Seat.findAll().then(function (seats) {
            seats = seats.map(function(seat){
                return {
                    'columna': seat.column, 
                    'fila': seat.row, 
                    'estado': seat.state === 1 ? 'blocked' : 'sold',
                    'seccion': seat.section
                }
            })
            callback(seats);
        }).catch(function (err) {
            callback({});
        });;
    });

    socket.on('seatModified', function (data, callback) {
        console.log('seat modified ', data);

        if (data.estado === 'blocked') {
            console.log(Seat);
            Seat.findOne({
                where: {
                    row: data.fila,
                    column: data.columna,
                    section: data.seccion
                }
            }).then(function (seat) {
                if (seat === null) {
                    Seat.create(
                        {
                            row: data.fila,
                            column: data.columna,
                            section: data.seccion,
                            state: data.estado == 'bloqueado' ? 1 : 2,
                            transactionl: '',
                        }).then(seat => {
                            callback({
                                status: true,
                                message: 'Asiento bloqueado',
                                seat: seat,
                            })
                        })
                } else
                    callback({
                        status: false,
                        message: 'Ese asiento ya esta ocupado'
                    })

            });
        } else if (data.estado === 'sold') {
            Seat.findOne({
                where: {
                    row: data.fila,
                    column: data.columna,
                    section: data.seccion
                }
            }).then(function (seat) {
                if (seat === null) {
                    callback({
                        status: false,
                        message: 'No se encontro el asiento'
                    })
                } else {
                    seat.state = 2;
                    seat.save().then(() => {
                        callback({
                        status: true,
                        message: 'Asiento vendido'
                    })  
                    });
                }

            });
        } else if (data.estado === 'free') {
            Seat.findOne({
                where: {
                    row: data.fila,
                    column: data.columna,
                    section: data.seccion
                }
            }).then(function (seat) {
                if (seat === null) {
                    callback({
                        status: false,
                        message: 'No se encontro el asiento'
                    })
                } else {
                    seat.destroy();
                    callback({
                        status: true,
                        message: 'Asiento liberado'
                    })
                }
                   

            });
        }

        seatModified(data);
        //    io.emit('newSeatModified', data);
    });
});

let checkUserConnected = (ip) => {
    for (var i = 0; i < users.length; i++) {
        let socket = users[i];
        let address = socket.handshake.address;
        if (address === ip) {
            return true;
        }
    }

    return false;
}

let deleteUser = (socket) => {
    for (var i = 0; i < users.length; i++) {
        if (users[i] === socket) {
            users.splice(i, 1);
            break;
        }
    }
}

server.listen(port, () => console.log(`Listening on port ${port}`));