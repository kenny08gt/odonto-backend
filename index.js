require('dotenv').config();
var nodemailer = require('nodemailer');
const express = require('express');
const http = require("http");
const path = require('path');
const socketIo = require("socket.io");
const axios = require("axios");
const index = require("./routes/index");
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var morgan = require('morgan');
var bcrypt = require('bcrypt');
const cors = require('cors');
var convert = require('xml-js');
var sha1 = require('sha1');

var PreXmlInfo = require('./preprocessingtoken');

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
let Transaction = require("./models/Transaction")(sequelize, DataTypes);

// Delete asientos bloqueados que se quedaron clonados
Seat.findAll({
    where: {
        state: 1, // Estado bloqueado
    }
}).then(function (seats) {
    console.log('delete seats bloqueados');
    if (seats !== null) {
        seats.forEach(seat => {
            console.log('borrar asiento ', seat);
            seat.destroy();
        });
    }
});

let users = {};
let orders = {};
let timers = {};
let sockets = {};

//const sequelize = require("./connection");
const app = express();
const port = process.env.PORT || 9000;
// app.use(index);
const corsOptions = {
    origin: true,
    credentials: true
};

app.use(cors(corsOptions));

app.use(express.static(path.join(__dirname + '/frontend/', 'build')));
app.use(bodyParser.json()); // support json encoded bodies
app.use(cookieParser());

app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.get('/payment-callback', function (req, res) {
    //ID=xfuD2JtW9kOQzwdYWb5Yqg2&RespCode=3&ReasonCode=11
    let id = req.query.ID;
    let resp_code = req.query.RespCode;
    let reason_code = req.query.ReasonCode;
    // res.send('loading...<br>ID: '+id+"<br>RESPCODE: "+resp_code+"<br>REASONCODE: "+reason_code);
    console.log(id);

    let params = '<string xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://schemas.firstatlanticcommerce.com/gateway/data">' + id + '</string>';
    // axios.post('', params)
    axios({
        method: 'post',
        url: 'https://ecm.firstatlanticcommerce.com/PGServiceXML/HostedPageResults',
        headers: {}, 
        data: params
      })
        .then(response => {
            if (resp_code == 1) {
                res.send('<img src="/glow.gif"><br>ID: ' + id + "<br>RESPCODE: " + resp_code + "<br>REASONCODE: " + reason_code + "<br><br> <strong style='font-size:10rem;'>APPROVED</strong>");
            } else if (resp_code == 2) {
                res.send('<img src="/glow.gif"><br>ID: ' + id + "<br>RESPCODE: " + resp_code + "<br>REASONCODE: " + reason_code + "<br><br> <strong style='font-size:10rem;'>DECLINED</strong>");
            } else if (resp_code == 3) {
                res.send('<img src="/glow.gif"><br>ID: ' + id + "<br>RESPCODE: " + resp_code + "<br>REASONCODE: " + reason_code + "<br><br> <strong style='font-size:10rem;'>ERROR</strong>");
            } else {
                res.send('<img src="/glow.gif"><br>ID: ' + id + "<br>RESPCODE: " + resp_code + "<br>REASONCODE: " + reason_code + "<br><br> <strong style='font-size:10rem;'>Nunca debería entrar aqui</strong>");
            }

            console.log(response);
            let data = JSON.parse(convert.xml2json(response.data, { compact: true, spaces: 4 }));
            console.log('***((()()******');
            console.log(data)
            console.log('***((()()******');
            // get the custom order id from the response
            let user = orders[data.HostedPageResultsResponse.AuthResponse.OrderNumber];

            //save transaction
            // update the table transaction
            // update seats states.
            let seats = timers[user.id]['seats'];
            Transaction.create({
                user_id: user.id,
                order_id: data.HostedPageResultsResponse.AuthResponse.OrderNumber,
                state: resp_code, //1 exitoso 2 denegado 3 error
                seats: seats,
                transaction_raw: data
            }).then(function () {

                seats.forEach(function(seat) {
                    seat.update({
                        state: 0
                      })
                });

                let socket = users[user.id]['socket'];
                socket.emit('payment.result.' + user.id, {
                    reason: data.HostedPageResultsResponse.AuthResponse.CreditCardTransactionResults.ReasonCodeDescription,
                    status: resp_code //1 exitoso 2 denegado 3 error
                });
            });

        })
        .catch(error => {
            console.log(error);
        });
});

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
            User.create({
                firstname: req.body.firstname,
                lastname: req.body.lastname,
                telephone: req.body.telephone,
                email: req.body.email,
                comment: req.body.comment,
                register_number: req.body.register_number,
                university: req.body.university,
                password: ''
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
        }
    });
});

app.post('/login', function (req, res) {
    console.log("name: " + req.body.firstname + ", lastname: " + req.body.lastname);
    // var isAdmin =req.body.email == 'erickimpladent@gmail.com';
    User.findOne({
        where: {
            email: req.body.email,
            firstname: req.body.firstname,
            lastname: req.body.lastname
        }
    }).then(function (user) {
        if (!user) {
            res.json({
                state: false,
                message: 'No existe este usuario or mala combinación de nombre y apellido'
            });
        } else {
            //req.session.user = user.dataValues;
            users[user.id] = {};
            users[user.id]['socket'] = null;
            // TODO: Remove this
                    //    user.admin = true;
            console.log(user);
            res.json({
                state: true,
                message: 'Login exitoso!',
                user: user
            });
        }
    });
});

// route for user logout
app.get('/logout', (req, res) => {

    res.redirect('/');
});

app.post('/report', (req, res) => {
    console.log('report get');
    // if (req.session.user && req.cookies.user_sid && !req.session.user.admin) {
    //     res.redirect('/');
    // } else {
    Seat.findAll({
        where: {
            state: 0, // Estado vendido
        }
    }).then(function (seats) {
        if (seats === null) {
            res.json({
                state: false,
                message: 'Asientos no encontrados'
            })
        } else {
            seats = seats.map(function (seat) {
                return {
                    'columna': seat.column,
                    'fila': seat.row,
                    'estado': seat.state === 1 ? 'blocked' : 'sold',
                    'curso': seat.course,
                    'seccion': seat.section,
                    'name': seat.name,
                    'register_number': seat.register_number,
                    'university': seat.university,
                    'no_document': seat.no_document
                }
            })
            res.json({
                state: true,
                message: 'Todos los asientos',
                seats_solds: seats
            })
        }
    });
    // }
});

app.post('/get-payment-form', (req, res) => {
    console.log(req.body);
    let user = req.body.user;
    var xmlDoc = JSON.parse(convert.xml2json(PreXmlInfo,{ compact: true, spaces: 4 }));
    var AmountRef =  xmlDoc.HostedPagePreprocessRequest.TransactionDetails.Amount;
    var cartTotalString = `${req.body.cartTotal.toString()}00`;
    var arrayStr = cartTotalString.split('');
    var amountStr = Array.from({length:12-arrayStr.length}).map(x=>'0').join(''); 
    xmlDoc.HostedPagePreprocessRequest.TransactionDetails.Amount = amountStr+cartTotalString;

    // var OrderNumberRef=xmlDoc.getElementsByTagName("OrderNumber")[0].childNodes[0];
    // OrderNumberRef.nodeValue = this.generateOrderNumber();
    xmlDoc.HostedPagePreprocessRequest.TransactionDetails.OrderNumber = generateOrderNumber();
    let order_id = xmlDoc.HostedPagePreprocessRequest.TransactionDetails.OrderNumber;
    // //generating signature
    var ProcessingPass = 'KI73nt6s';
    var MerchantId = '88801272';
    var AcquirerId = '464748';
    var Currency   = '320'; 
    var Signature = (new Buffer(sha1(`${ProcessingPass}${MerchantId}${AcquirerId}${order_id}${xmlDoc.HostedPagePreprocessRequest.TransactionDetails.Amount}${Currency}`), "hex").toString('base64')); 
    
    // var SignatureRef=xmlDoc.getElementsByTagName("Signature")[0].childNodes[0];
    // SignatureRef.nodeValue = Signature;
    xmlDoc.HostedPagePreprocessRequest.TransactionDetails.Signature = Signature;

    users[user.id]['order_id'] = order_id;
    orders[order_id] = user;
    let seats = timers[user.id]['seats'];
    seats = seats.map(function (seat) {
        return seat.order_id = order_id;
    });

    timers[user.id]['seats'] = seats;

    axios.post('https://ecm.firstatlanticcommerce.com/PGServiceXML/HostedPagePreprocess', convert.json2xml(xmlDoc, {compact: true, ignoreComment: true, spaces: 4}))
    .then(response => {
        let data = JSON.parse(convert.xml2json(response.data, { compact: true, spaces: 4 }));
        console.log(data);
        res.send({
            securityToken: data.HostedPagePreprocessResponse.SecurityToken._text,
            order_id: order_id
        });
    })
    .catch(err => {
        console.log(error)
    })
})

//TODO implement save the order from the frontend
app.post('/save_order', async (req, res) => {
    let seats = req.body.seats;
    console.log('save order ', seats);
    try {
        for (var key in seats) {
            console.log('key ' + key);
            if (seats.hasOwnProperty(key)) {
                seat = seats[key];
                console.log(seat);
                let seat_old = await Seat.findOne({
                    where: {
                        row: seat.fila,
                        column: seat.columna,
                        section: seat.seccion,
                        course: seat.curso
                    }
                });
                if (seat_old === null) {
                    let seatCreated = await Seat.create({
                        row: seat.fila,
                        column: seat.columna,
                        section: seat.seccion,
                        course: seat.curso,
                        state: 0,
                        'name': seat.name,
                        'register_number': seat.register_number,
                        'university': seat.university,
                        'no_document': seat.no_document,
                        'precio': seat.precio
                    });
                    const { column, row, state, course, section } = seatCreated;
                    seatModified({
                        'columna': column,
                        'fila': row,
                        'estado': state === 1 ? 'blocked' : 'sold',
                        'curso': course,
                        'seccion': section
                    });
                } else {
                    seat_old.destroy();
                    let seatCreated = await Seat.create({
                        row: seat.fila,
                        column: seat.columna,
                        section: seat.seccion,
                        course: seat.curso,
                        state: 0,
                        'name': seat.name,
                        'register_number': seat.register_number,
                        'university': seat.university,
                        'no_document': seat.no_document,
                        'precio': seat.precio
                    });
                    const { column, row, state, course, section } = seatCreated;
                    seatModified({
                        'columna': column,
                        'fila': row,
                        'estado': state === 1 ? 'blocked' : 'sold',
                        'curso': course,
                        'seccion': section
                    });
                }
            }
        }
        res.json({
            status: true,
            message: 'Order salvada',
            seat: seat,
        });
    } catch (error) {
        res.json({
            status: false,
            message: 'Error al guardar asientos',
            seat: null,
        });
    }
});

app.post('/sendEmail', function (req, res) {
    const { mailOptions } = req.body;
    console.log(mailOptions);
    if (mailOptions) {
        var transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'rluis4490@gmail.com',
                pass: 'lamaravilla.net123'
            }
        });
        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
                res.json(error);
            } else {
                res.json({ message: 'Email sent: ' + info.response });
            }
        });
    }
});

let io = null;
let server = null;
var fs = require('fs');

if (process.env.NODE_ENV == 'development') {
    console.log('DEVELOPMENT')
    app.listen(9001);
    server = http.createServer(app);
    io = socketIo(server);

    server.listen(port, () => console.log(`Listening on port ${port}`));
} else {
    //    var https = require('https');
    //    var privateKey = fs.readFileSync('odontologiaindependiente.key', 'utf8').toString();
    //    var certificate = fs.readFileSync('cert.crt', 'utf8').toString();
    //    var dad = fs.readFileSync('bundle.crt', 'utf8').toString();
    //    var credentials = { key: privateKey, cert: certificate, ca: dad };

    server = http.createServer(app);

    //    server = https.createServer(credentials, app);
    io = socketIo.listen(server);
    server.listen(port, () => console.log(`Listening on port ${port}`));

    //    httpsServer.listen(443, () => console.log(`Listening on port 443`));
}

Array.prototype.insert = function (index, item) {
    this.splice(index, 0, item);
};

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

const StringToXML = (oString) => {
    return (new DomParser()).parseFromString(oString);
};

const generateOrderNumber = () =>{
    var numberRandom = Math.floor(Math.random()*(999-100+1)+100);
    var orderNumberGenerated= `UNB${(+ new Date())}${numberRandom}`;
    return  orderNumberGenerated;
};

const seatModified = async data => {
    try {
        console.log('sockets ' + Object.keys(sockets).length);
        for (var key in sockets) {
            if (sockets.hasOwnProperty(key)) {
                console.log(key + " -> " + sockets[key]);
                socket_ = sockets[key];
                socket_.emit('newSeatModified', data);
            }
        }
    } catch (error) {
        console.log('error on noticeuserConnectd');
        console.log(error);
        console.error(`Error: ${error.code}`);
    }
}

io.on("connection", socket => {
    timers[socket.id] = {};
    sockets[socket.id] = socket;
    socket.on('connected', function (data, callback) {
        let user = data.user;
        console.log(data);
        if (user != null) {
            users[user.id] = {}
            users[user.id]['socket'] = socket;
            timers[user.id] = {};
        }

        console.log('connected from frontend');
        let seats = Seat.findAll().then(function (seats) {
            seats = seats.map(function (seat) {
                return {
                    'columna': seat.column,
                    'fila': seat.row,
                    'estado': seat.state === 1 ? 'blocked' : 'sold',
                    'curso': seat.course,
                    'seccion': seat.section
                }
            });
            callback(seats);
        }).catch(function (err) {
            callback({});
        });;
    });

    noticeUserConnected(socket);

    socket.on("disconnect", (data) => {
        let user = data.user;

        if (user == null) {
            console.log('Event disconnect, user undefined');
            return false;
        }

        var fn = timers[user.id]['timer'];
        try {
            fn._destroyed = true;
            clearInterval(timers[user.id]['timer']);
        } catch (error) {

        }
        delete timers[user.id]['timer'];
    });

    socket.on('close-timer', function (data) {
        let user = data.user;
        console.log('close-timer');
        console.log(data);
        if (user == null) {
            console.log('Event close-time, user undefined');
            return false;
        }

        try {
            var fn = timers[user.id]['timer'];
            fn._destroyed = true;
            clearInterval(timers[user.id]['timer']);
            timers[user.id]['timer'] = null;
            delete timers[user.id]['timer'];
        } catch (error) {
            console.log('Catch close timer ')
            console.log(error);
        }
    });

    socket.on('seatModified', function (data, callback) {
        console.log('seatModified event');
        console.log(data);
        let user = data.user;

        if (user == null) {
            console.log('Event seatModified, user undefined');
            return false;
        }

        if (data.estado === 'blocked') {
            console.log(Seat);
            Seat.findOne({
                where: {
                    row: data.fila,
                    column: data.columna,
                    section: data.seccion,
                    course: data.curso
                }
            }).then(function (seat) {
                if (seat === null) {
                    Seat.create(
                        {
                            row: data.fila,
                            column: data.columna,
                            section: data.seccion,
                            course: data.curso,
                            state: data.estado == 'blocked' ? 1 : 0,
                            transactionl: '',
                        }).then(seat => {

                            if (!timers[user.id]['seats']) {
                                timers[user.id]['seats'] = [];
                            }
                            timers[user.id]['seats'].push(data)

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
                    section: data.seccion,
                    course: data.curso,
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
                    section: data.seccion,
                    course: data.curso
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
        let user = data.user;
        console.log('countdownStart')
        console.log(data);
        if (user == null) {
            console.log('Event countdownStart, user undefined');
            return false;
        }

        console.log('countdownStart for socket ' + user.id)
        var timeleft = 10 * 60;
        var downloadTimer = handleTimer(socket, timeleft, callback);
        if (timers[user.id] !== undefined) {
            timers[user.id]['timer'] = downloadTimer;
        }
    })

    socket.on('sendOrderNumber', function (data, callback) {
        let user = data.user;
        let order_id = data.order;

        console.log('sendOrderNumber socket -- ' + order_id);
        users[user.id]['order_id'] = order_id;
        orders[order_id] = user;
        let seats = timers[user.id]['seats'];
        seats = seats.map(function (seat) {
            return seat.order_id = order_id;
        });

        timers[user.id]['seats'] = seats;
        callback('');
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
        // console.log('time left ' + timeleft);
        timeleft -= 1;
        if (timeleft <= 0) {
            //            delete timers[socket.handshake.session.user.id]['timer'];

            clearInterval(downloadTimer);
            callback('countdown finished');
            console.log('fnished countdown');
        }
    }, 1000);

    return downloadTimer;

}

