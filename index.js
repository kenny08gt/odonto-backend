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

var enviroment = "marlin"
//var enviroment = "ecm"

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
let Order = require("./models/Order")(sequelize, DataTypes);

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
app.use(express.static('public'))
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
    let seat_by_userRef = null;
    axios({
        method: 'post',
        url: 'https://' + enviroment + '.firstatlanticcommerce.com/PGServiceXML/HostedPageResults',
        headers: {},
        data: params
    })
        .then(response => {
            let user = orders[id];
            console.log(user?`line 105: user finded`:`line 105:  user not found`);
            seat_by_userRef = timers[user.id]['seats'];
            timers[user.id]['seats']=null;
            if (resp_code == 1) {
                res.send('<img style="max-height: 150px;" src="/glow.gif"><br>ID: ' + id + "<br>RESPCODE: " + resp_code);
            } else if (resp_code == 2) {
                res.send('<img style="max-height: 150px;" src="/glow.gif"><br>ID: ' + id + "<br>RESPCODE: " + resp_code);
            } else if (resp_code == 3) {
                res.send('<img style="max-height: 150px;" src="/glow.gif"><br>ID: ' + id + "<br>RESPCODE: " + resp_code);
            } else {
                res.send('<img style="max-height: 150px;" src="/glow.gif"><br>ID: ' + id + "<br>RESPCODE: " + resp_code);
            }

            let data = JSON.parse(convert.xml2json(response.data, { compact: true, spaces: 4 }));
            console.log('line 118: response data converted');
            // get the custom order id from the response
            //let user = orders[id];

            //save transaction
            // update the table transaction
            // update seats states.
            let seats = seat_by_userRef;
            console.log(seat?`line 125:${seats.length}`:'line 125:sin sientos');
            Transaction.create({
                user_id: user.id,
                order_id: id,
                state: resp_code, //1 exitoso 2 denegado 3 error
                seats: JSON.stringify(seats),
                transaction_raw: response.data
            }).then(function () {
                console.log('line 133: Transaction created');
                seats.forEach(function (seat) {
                    Seat.findOne({
                        where: {
                            row: seat.fila,
                            column: seat.columna,
                            section: seat.seccion,
                            course: seat.curso,
                        }
                    }).then(function (seat_) {
                        // Check if record exists in db
                        if (seat_) {
                            console.log('line 145: seat existe');
                            if (resp_code == 1) {
                                console.log('line 147: response code 1');
                                seat_.update({
                                    state: 0 // actualizar a vendido
                                })    
                                .then(function (seat__) {

                                        Transaction.findOne({
                                            where: {
                                                user_id: user.id,
                                                order_id: id,
                                                state: resp_code, //1 exitoso 2 denegado 3 error
                                                seats: JSON.stringify(seats),
                                                transaction_raw: response.data
                                            }
                                        }).then((transaction) => {
                                            console.log('line 162: response code 1');
                                            Order.create({
                                                user_id: user.id,
                                                transaction_id: transaction.id,
                                                seat_id: seat__.id,
                                                uuid: transaction.order_id,
                                            }).catch(error=>console.log(`line 168:${error}`));
                                            console.log('line 169:seat updated');
                                            seatModified({
                                                'columna': seat__.column,
                                                'fila': seat__.row,
                                                'estado': 'sold',
                                                'curso': seat__.course,
                                                'seccion': seat__.section
                                            });
                                            console.log('line 177: seat modified SOLD');
                                        }).catch((error) => {
                                            console.log('Transaction not found');
                                            console.log(error);
                                        })
                                    });
                            } else {
                                console.log('seat modified FREE');
                                console.log(Object.values(seat_).join('~'));
                                seat_.destroy();
                                seatModified({
                                    'columna': seat_.column,
                                    'fila': seat_.row,
                                    'estado': 'free',
                                    'curso': seat_.course,
                                    'seccion': seat_.section
                                });
                            }
                        }
                    }).catch(error => {
                        console.log('trono el findone');
                    })
                });

                let socket = users[user.id]['socket'];
                console.log(socket?`socket for user${user.id} finded`:`socket for user${user.id} NOT found`);
                socket.emit('payment.result.' + user.id, {
                    reason: data.HostedPageResultsResponse.AuthResponse.CreditCardTransactionResults.ReasonCodeDescription._text,
                    status: resp_code //1 exitoso 2 denegado 3 error
                });

                if (resp_code == 1) {
                    sendOrderEmail(seats, user);
                }
            }).catch(error=> console.log(`Transaction Create Error:${error}`));

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
                        //req.session.user = user.dataValues;
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
            email: req.body.email
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
            
            let strFirsName = user.firstname.toString().trim().split(" ");
            let strLastName = user.lastname.toString().trim().split(" ");
            console.log(strFirsName);
            console.log(strLastName);
            try {
                if(strFirsName[0]==req.body.firstname && strLastName[0]==req.body.lastname){
                    if(user.email == 'erickimpladent@gmail.com') {
                        user.firstname = 'Erick';
                        user.lastname = 'Hernandez';
                    }
                    res.json({
                        state: true,
                        message: 'Login exitoso!',
                        user: user
                    });
                    return;        
                }
            } catch (error) {console.log(error);}
            res.json({
                state: false,
                message: 'No existe este usuario or mala combinación de nombre y apellido'
            });
        }
    });
});

// route for user logout
app.get('/logout', (req, res) => {

    res.redirect('/');
});

app.post('/updateSeatData', async(req,res) => {
    console.log('update instance seat')
    let seat = req.body
    let seatInstance = await Seat.findOne({
        where: {
            row: seat.fila,
            column: seat.columna,
            section: seat.seccion,
            course: seat.curso
        }
    });

    if(seatInstance){
        seatInstance.name = seat.name;
        seatInstance.register_number = seat.register_number;
        seatInstance.university = seat.university;
        seatInstance.no_document = seat.no_document;
        await seatInstance.save();
        res.json({
            state: true,
            message: 'Información actualizada'
        })
        return;
    }
    res.json({
        state: false,
        message: 'No se encontró el asiento solicitado'
    })
});

app.post('/report', async (req, res) => {
    console.log('report get');
    // if (req.session.user && req.cookies.user_sid && !req.session.user.admin) {
    //     res.redirect('/');
    // } else {

        const { QueryTypes } = require('sequelize');
        let seats = await sequelize.query('select s.precio, s.no_document,s.university,s.register_number,s.name, s.state, u.email, o.transaction_id, o.seat_id, s.column, s.row, s.section, s.course from orders o join seats s on s.id = o.seat_id join users u on u.id = o.user_id  where s.state = 0;', {
          // A function (or false) for logging your queries
          // Will get called for every SQL query that gets sent
          // to the server.
          logging: console.log,
        
          // If plain is true, then sequelize will only return the first
          // record of the result set. In case of false it will return all records.
          plain: false,
        
          // Set this to true if you don't have a model definition for your query.
          raw: true,
        
          // The type of query you are executing. The query type affects how results are formatted before they are passed back.
          type: QueryTypes.SELECT
        });

//        console.log(seats);

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
                    'no_document': seat.no_document,
                    'email': seat.email,
                    'precio': seat.precio
                }
            })
            res.json({
                state: true,
                message: 'Todos los asientos',
                seats_solds: seats
            })
        }
    // }
});

app.post('/get-payment-form', async (req, res) => {
    console.log(req.body);
    let seats = req.body.seats;
    let user = req.body.user;
    var xmlDoc = JSON.parse(convert.xml2json(PreXmlInfo, { compact: true, spaces: 4 }));
    var AmountRef = xmlDoc.HostedPagePreprocessRequest.TransactionDetails.Amount;
    var cartTotalString = `${req.body.cartTotal.toString()}00`;
    var arrayStr = cartTotalString.split('');
    var amountStr = Array.from({ length: 12 - arrayStr.length }).map(x => '0').join('');
    xmlDoc.HostedPagePreprocessRequest.TransactionDetails.Amount = amountStr + cartTotalString;

    // var OrderNumberRef=xmlDoc.getElementsByTagName("OrderNumber")[0].childNodes[0];
    // OrderNumberRef.nodeValue = this.generateOrderNumber();
    xmlDoc.HostedPagePreprocessRequest.TransactionDetails.OrderNumber = generateOrderNumber();
    let order_id = xmlDoc.HostedPagePreprocessRequest.TransactionDetails.OrderNumber;
    // //generating signature
    var ProcessingPass = process.env.PROCESSING_PASSWORD;
    var MerchantId = process.env.MERCHANT_ID;
    var AcquirerId = process.env.ACQUIRER_ID;
    var Currency = process.env.CURRENCY;
    var Signature = (new Buffer(sha1(`${ProcessingPass}${MerchantId}${AcquirerId}${order_id}${xmlDoc.HostedPagePreprocessRequest.TransactionDetails.Amount}${Currency}`), "hex").toString('base64'));

    // var SignatureRef=xmlDoc.getElementsByTagName("Signature")[0].childNodes[0];
    // SignatureRef.nodeValue = Signature;
    xmlDoc.HostedPagePreprocessRequest.TransactionDetails.Signature = Signature;
    xmlDoc.HostedPagePreprocessRequest.TransactionDetails.MerchantId = MerchantId;

    axios.post('https://' + enviroment + '.firstatlanticcommerce.com/PGServiceXML/HostedPagePreprocess', convert.json2xml(xmlDoc, { compact: true, ignoreComment: true, spaces: 4 }))
        .then(async (response) => {
            let data = JSON.parse(convert.xml2json(response.data, { compact: true, spaces: 4 }));
            users[user.id]['order_id'] = order_id;
            orders[data.HostedPagePreprocessResponse.SecurityToken._text] = user;
            orders[order_id] = user;
//            let seats = timers[user.id]['seats'];

            for (var key in seats) {
                console.log('key ' + key);
                if (seats.hasOwnProperty(key)) {
                    seat = seats[key]; 
                    let seat_old = await Seat.findOne({
                        where: {
                            row: seat.fila,
                            column: seat.columna,
                            section: seat.seccion,
                            course: seat.curso
                        }
                    });
                    if (seat_old === null) {
                        await Seat.create({
                            row: seat.fila,
                            column: seat.columna,
                            section: seat.seccion,
                            course: seat.curso,
                            state: 1, //bloqueado aun
                            'name': seat.name,
                            'register_number': seat.register_number,
                            'university': seat.university,
                            'no_document': order_id,
                            'precio': seat.precio
                        });
                    } else {
                        await seat_old.destroy();
                        await Seat.create({
                            row: seat.fila,
                            column: seat.columna,
                            section: seat.seccion,
                            course: seat.curso,
                            state: 1, // bloqueado aun
                            'name': seat.name,
                            'register_number': seat.register_number,
                            'university': seat.university,
                            'no_document': order_id,
                            'precio': seat.precio
                        });
                    }
                }
            }

            seats = seats.map(function (seat) {
                seat.order_id = order_id;
                return seat;
            });

            timers[user.id]['seats'] = seats;

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

                    let tempSeat = await Seat.findOne({
                        where: {
                            row: seat.fila,
                            column: seat.columna,
                            section: seat.seccion,
                            course: seat.curso
                        }
                    })
                    await Order.create({
                        user_id: req.body.user.id,
                        transaction_id: null,
                        seat_id: tempSeat.id,
                        uuid: null,
                    })
                    const { column, row, state, course, section } = seatCreated;
                    seatModified({
                        'columna': column,
                        'fila': row,
                        'estado': state === 1 ? 'blocked' : 'sold',
                        'curso': course,
                        'seccion': section
                    });
                } else {
                    await seat_old.destroy();
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
                    let tempSeat = await Seat.findOne({
                        where: {
                            row: seat.fila,
                            column: seat.columna,
                            section: seat.seccion,
                            course: seat.curso
                        }
                    })
                    await Order.create({
                        user_id: req.body.user.id,
                        transaction_id: null,
                        seat_id: tempSeat.id,
                        uuid: null,
                    })
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
        console.log("my error: " +error)
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
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASSWORD
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

app.post('/checkSeatsByUser',async function (req, res) {
    const {seats,user} = req.body;
    let otherUsers  = users.filter(use_r=> use_r.id!== user.id);
    let status = false;
    seats.forEach(async seat=>{
        let seat_inDB = await Seat.findOne({
            where: {
                row: seat.fila,
                column: seat.columna,
                section: seat.seccion,
                course: seat.curso
            }
        });
        if(seat_inDB){
            otherUsers.forEach(otherUser=>{
                try {
                    const {row,column,section,course} = seat_inDB;
                    let otherSeats = timers[otherUser.id]['seats'] || [];    
                    let finded = otherSeats.find(
                        (otherSeat)=> 
                        [otherSeat.fila,otherSeat.columna,otherSeat.seccion,otherSeat.curso].join("")===
                        Object.values({row,column,section,course}).join("") );
                    if(finded){
                        status = true;       
                    }    
                } catch (error) {}
            });
        }
        res.json({ status: status });
    });
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

const sendOrderEmail = function (seats, user) {
    console.log("send order email");
    let body = "<table>";
    let order_id = users[user.id]['order_id'];
    seats.forEach(function (seat) {
        body += '<tr><td>fila: ' + seat.fila + '</td><td>columna: ' + seat.columna + '</td><td>sección: ' + seat.seccion + '</td><td>curso: ' + seat.curso + '</td></tr>'
    })

    body += '</table>';

    var message = {
        from: "no-reply@server.com",
        to: user.email,
        cc: "erickimpladent@gmail.com",
        subject: "Compra exitosa Orden " + order_id,
        text: "Su compra ha sido exitosa, Bienvenido a Unbiased 2020. Order id: " + order_id + ". Asientos:" + body,
        html: "Su compra ha sido exitosa. <br> Order id: " + order_id + "<br>Asientos:" + body
    };

    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASSWORD
        }
    });
    transporter.sendMail(message, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('email sent', info.response)
        }
    });
}

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

const generateOrderNumber = () => {
    var numberRandom = Math.floor(Math.random() * (999 - 100 + 1) + 100);
    var orderNumberGenerated = `UNB${(+ new Date())}${numberRandom}`;
    return orderNumberGenerated;
};

const seatModified = async data => {
    try {
        //      console.log('sockets ' + Object.keys(sockets).length);
        for (var key in sockets) {
            if (sockets.hasOwnProperty(key)) {
                //                console.log(key + " -> " + sockets[key]);
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
            for (var key in users) {
                if (users.hasOwnProperty(key)) {
                    if (users[key]['socket'] === socket) {
                        // call function
                        deleteTimer(key);
                        break;
                    }
                }
            }
            return false;
        }

        //call function
        deleteTimer(user.id);
    });

    socket.on('close-timer', function (data) {
        let user = data.user;
        console.log('close-timer');
        //        console.log(data);
        if (user == null) {
            console.log('Event close-time, user undefined');
            return false;
        }

        try {
            var fn = timers[user.id]['timer'];
            if (fn !== undefined)
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
                    console.log('Asiento no encontrado para liberar', data);
                    callback({
                        status: false,
                        message: 'No se encontro el asiento'
                    })
                } else {
                    seat.destroy();
                    let seatsUser = timers[user.id]['seats'] || [];    
                    timers[user.id]['seats'] = seatsUser.filter(
                        (otherSeat)=> 
                        [otherSeat.fila,otherSeat.columna,otherSeat.seccion,otherSeat.curso].join("")!==
                        [data.fila,data.columna,data.seccion,data.curso].join("") );
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

let deleteTimer = (user_id) => {
    var fn = timers[user_id]['timer'];
    try {
        fn._destroyed = true;
        clearInterval(timers[user_id]['timer']);
    } catch (error) {

    }
    delete timers[user_id]['timer'];

    let seats = timers[user_id]['seats'];

    if (!seats) {
        console.log('seats not found related with user ' + user_id);
        return false;
    }

    seats.forEach(data => {
        Seat.findOne({
            where: {
                row: data.fila,
                column: data.columna,
                section: data.seccion,
                course: data.curso
            }
        }).then(function (seat) {
            if (seat === null) {
                console.log('No se pudo liberar asiento, al borrar timer', data);
            } else {
                if(!(seat.estado==='sold')){
                    seat.destroy();
                    seatModified({
                        'columna': seat.column,
                        'fila': seat.row,
                        'estado': 'free',
                        'curso': seat.course,
                        'seccion': seat.section
                    });
                }
            }
        });

    });
}

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

            for (var key in users) {
                if (users.hasOwnProperty(key)) {
                    if (users[key]['socket'] === socket) {
                        // call function
                        deleteTimer(key);
                        break;
                    }
                }
            }
        }
    }, 1000);

    return downloadTimer;

}

