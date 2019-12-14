require('dotenv').config();

const express = require('express');
const http = require("http");
const path = require('path');
const socketIo = require("socket.io");
const axios = require("axios");
const index = require("./routes/index");
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var sharedsession = require("express-socket.io-session");
var morgan = require('morgan');
var bcrypt = require('bcrypt');
const cors = require('cors');

const saltRounds = 12;
var session = require("express-session")({
    key: 'user_sid',
    secret: 'lsrsdfg34oiwlxcv.-a.fpqqaspqwe?q2@#asdf',
    resave: true,
    saveUninitialized: true,
    cookie: {
        expires: 600000
    }
});

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

let users = {};
let timers = {};

//const sequelize = require("./connection");
const app = express();
const port = process.env.PORT || 4001;
// app.use(index);
const corsOptions = {
    origin: 'https://odontologiaindependiente.com',
    credentials: true
};
  
app.use(cors(corsOptions));
  
app.use(express.static(path.join(__dirname + '/frontend/', 'build')));
app.use(bodyParser.json()); // support json encoded bodies
app.use(cookieParser());

// initialize express-session to allow us track the logged-in user across sessions.
app.use(session);



app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// This middleware will check if user's cookie is still saved in browser and user is not set, then automatically log the user out.
// This usually happens when you stop your express server after login, your cookie still remains saved in the browser.
app.use((req, res, next) => {
    if (req.cookies.user_sid && !req.session.user) {
        res.clearCookie('user_sid');
    }
    next();
});


// middleware function to check for logged-in users
var sessionChecker = (req, res, next) => {
    if (req.session.user && req.cookies.user_sid) {
        res.redirect('/');
    } else {
        next();
    }
};


app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname + '/frontend/', 'build', 'index.html'));
});

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
                            req.session.user = user.dataValues;
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
                    req.session.user = user.dataValues;
                    users[user.id] = [];
                    users[user.id]['socket'] = null;
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

// route for user logout
app.get('/logout', (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
        delete users[res.session.user.id];
        res.clearCookie('user_sid');
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});

let io = null;
let server = null;
var fs = require('fs');

if (process.env.NODE_ENV == 'development') {
    console.log('DEVELOPMENT')
    app.listen(9000);
    server = http.createServer(app);
    io = socketIo(server);

    server.listen(port,  () => console.log(`Listening on port ${port}`));
} else {
    var https = require('https');
    var privateKey = fs.readFileSync('odontologiaindependiente.key', 'utf8').toString();
    var certificate = fs.readFileSync('cert.crt', 'utf8').toString();
    var dad = fs.readFileSync('bundle.crt', 'utf8').toString();
    var credentials = { key: privateKey, cert: certificate, ca: dad };


    var httpsServer = https.createServer(credentials, app);

//    server = https.createServer(credentials, app);
    io = socketIo.listen(httpsServer);
    
    httpsServer.listen(443, () => console.log(`Listening on port 443`));
}

Array.prototype.insert = function (index, item) {
    this.splice(index, 0, item);
};

io.use(sharedsession(session, {
    autoSave: true
}));


const noticeUserConnected = async socket => {
    try {
        console.log('users ' + Object.keys(users).length);
        for (var key in users) {
            if (users.hasOwnProperty(key)) {
                console.log(key + " -> " + users[key]);
                user = users[key];
                user['socket'].emit("userConected", Object.keys(users).length);
            }
        }
    } catch (error) {
        console.log('error on noticeuserConnectd');
        console.log(error);
        console.error(`Error: ${error.code}`);
    }
};

const seatModified = async data => {
    try {
        console.log('users ' + Object.keys(users).length);
        for (var key in users) {
            if (users.hasOwnProperty(key)) {
                console.log(key + " -> " + users[key]);
                user = users[key];
                user['socket'].emit('newSeatModified', data);
            }
        }
    } catch (error) {
        console.log('error on noticeuserConnectd');
        console.log(error);
        console.error(`Error: ${error.code}`);
    }
}

io.on("connection", socket => {

    if (!socket.handshake.session.user) {
        console.log('user not logged in')
        return false;
    }

    let address = socket.handshake.address;
    console.log("New client connected " + socket.handshake.session.user.id + ", ip: " + address);
    console.log(socket.handshake.session);

    // users.push(socket);
    if (socket.handshake.session.user)
        users[socket.handshake.session.user.id]['socket'] = socket;

    timers[socket.handshake.session.user.id] = {};
    noticeUserConnected(socket);

    socket.on("disconnect", () => {
        deleteUser(socket);
        clearInterval(timers[socket.handshake.session.user.id]['timer']);
        delete timers[socket.handshake.session.user.id];
        console.log("Client disconnected " + socket.handshake.session.user.id);
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

                            if (!timers[socket.handshake.session.user.id]['seats']) {
                                timers[socket.handshake.session.user.id]['seats'] = [];
                            }
                            timers[socket.handshake.session.user.id]['seats'].push(data)

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
        console.log('countdownStart for socket ' + socket.handshake.session.user.id)
        var timeleft = 1 * 60;
        var downloadTimer = handleTimer(socket, timeleft, callback);
        timers[socket.handshake.session.user.id]['timer'] = downloadTimer;
    })

    socket.on('countdownRestart', function (data, callback) {
        console.log('countdownRestart for socket ' + socket.handshake.session.user.id)

        clearInterval(timers[socket.handshake.session.user.id]['timer']);
        delete timers[socket.handshake.session.user.id];

        var timeleft = 1 * 60;
        var downloadTimer = handleTimer(socket, timeleft, callback);
        timers[socket.handshake.session.user.id]['timer'] = downloadTimer;
    })
});

let checkUserConnected = (ip) => {
    for (var i = 0; i < Object.keys(users).length; i++) {
        let socket = users[i];
        let address = socket.handshake.address;
        if (address === ip) {
            return true;
        }
    }

    return false;
}

let deleteUser = (socket) => {
    console.log('delete user');
    for (var key in users) {
        if (users.hasOwnProperty(key)) {
            if (users[key]['socket'] === socket) {
                delete users[key];
                break;
            }
        }
    }
}

let handleTimer = function (socket, timeleft, callback) {
    let downloadTimer = setInterval(function () {
        socket.emit('countdownStart', timeleft);
        console.log('time left ' + timeleft);
        timeleft -= 1;
        if (timeleft <= 0) {
            delete timers[socket.handshake.session.user.id]['timer'];

            clearInterval(downloadTimer);
            callback('countdown finished');
            console.log('fnished countdown');
        }
    }, 1000);

    return downloadTimer;

}

