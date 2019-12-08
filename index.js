require('dotenv').config();

const express = require('express');
const http = require("http");
const path = require('path');
const socketIo = require("socket.io");
const axios = require("axios");
const index = require("./routes/index");
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt');
const saltRounds = 12;

const { Sequelize, Model, DataTypes } = require('sequelize');
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
let User = require("./models/User")(sequelize, DataTypes);


//const sequelize = require("./connection");
const app = express();
const port = process.env.PORT || 4001;
// app.use(index);

app.use(express.static(path.join(__dirname + '/frontend/', 'build')));
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.post('/register', function (req, res) {
    console.log(req.body);
    User.findOne({
        where: {
            email: req.body.email
        }
    }).then(function (user) {
        if (user) {
            res.json({
                state: false,
                message: 'El usuario ya existe'
            });
        } else {
            bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
                User.create({
                    firstname: req.body.firstanme,
                    lastname: req.body.lastname,
                    telephone: req.body.telephone,
                    email: req.body.email,
                    comment: req.body.comment,
                    register_number: req.body.register_number,
                    university: req.body.university,
                    password: hash
                }).then(function () {
                    User.findOrCreate(
                        {
                            where: {
                                email: req.body.email
                            }
                        }).spread(function (user, created) {
                            console.log(user.get({
                                plain: true
                            }))
                            console.log(created)

                            res.json({
                                state: true,
                                message: 'Registro exitoso!',
                                user: user
                            });
                        })
                })

            });
        }
    });
});

app.post('/login', function (req, res) {
    console.log(req.body);
    User.findOne({
        where: {
            email: req.body.email
        }
    }).then(function (user) {
        if (!user) {
            res.json({
                state: false,
                message: 'No existe este usuario'
            });
        } else {
            bcrypt.compare(req.body.password, user.password, function (err, result) {
                if (result == true) {
                    res.json({
                        state: true,
                        message: 'Login exitoso!',
                        user: user
                    });
                } else {
                    res.json({
                        state: false,
                        message: 'Los datos no coinciden!',
                    });
                }
            });
        }
    });
});

app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname + '/frontend/', 'build', 'index.html'));
});
var fs = require('fs');
if (process.env.NODE_ENV == 'development') {
    app.listen(9000);
} else {
    var https = require('https');
    var privateKey = fs.readFileSync('odontologiaindependiente.key', 'utf8').toString();
    var certificate = fs.readFileSync('cert.crt', 'utf8').toString();
    var dad = fs.readFileSync('bundle.crt', 'utf8').toString();
    var credentials = { key: privateKey, cert: certificate, ca: dad };


    var httpsServer = https.createServer(credentials, app);
    httpsServer.listen(443, () => console.log(`Listening on port 443`));
}

Array.prototype.insert = function (index, item) {
    this.splice(index, 0, item);
};


const server = http.createServer(app);
const io = socketIo(server);
let users = [];
let timers = {};

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
    timers[socket.id] = {};
    noticeUserConnected(socket);

    socket.on("disconnect", () => {
        deleteUser(socket);
        clearInterval(timers[socket.id]['timer']);
        delete timers[socket.id];
        console.log("Client disconnected " + socket.id);
        noticeUserConnected();
    });

    socket.on('connected', function (data, callback) {
        console.log('connected from frontend');
        let seats = Seat.findAll().then(function (seats) {
            seats = seats.map(function (seat) {
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

                            if (!timers[socket.id]['seats']) {
                                timers[socket.id]['seats'] = [];
                            }
                            timers[socket.id]['seats'].push(data)

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
    });

    socket.on('countdownStart', function (data, callback) {
        console.log('countdownStart for socket ' + socket.id)
        var timeleft = 1 * 60;
        var downloadTimer = handleTimer(socket, timeleft, callback);
        timers[socket.id]['timer'] = downloadTimer;
    })

    socket.on('countdownRestart', function (data, callback) {
        console.log('countdownRestart for socket ' + socket.id)

        clearInterval(timers[socket.id]['timer']);
        delete timers[socket.id];

        var timeleft = 1 * 60;
        var downloadTimer = handleTimer(socket, timeleft, callback);
        timers[socket.id]['timer'] = downloadTimer;
    })
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

let handleTimer = function (socket, timeleft, callback) {
    let downloadTimer = setInterval(function () {
        socket.emit('countdownStart', timeleft);
        timeleft -= 1;
        if (timeleft <= 0) {
            delete timers[socket.id]['timer'];

            clearInterval(downloadTimer);
            callback('countdown finished');
            console.log('fnished countdown');
        }
    }, 1000);

    return downloadTimer;

}

server.listen(port, () => console.log(`Listening on port ${port}`));
