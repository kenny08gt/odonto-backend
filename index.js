require('dotenv').config();

const express = require('express');
const http = require("http");
const path = require('path');
const socketIo = require("socket.io");
const axios = require("axios");
const index = require("./routes/index");
const sequelize = require("./connection");
const app = express();
const port = process.env.PORT || 4001;
// app.use(index);

Array.prototype.insert = function (index, item) {
    this.splice(index, 0, item);
};

app.use(express.static(path.join(__dirname + '/frontend/', 'build')));
app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname + '/frontend/', 'build', 'index.html'));
});
app.listen(9000);

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

io.on('seatModified', function (data) {
    console.log(data);
    seatModified(data);
//    io.emit('newSeatModified', data);
});


io.on('connected', function (data, callback) {
    callback('test connected akn');
});


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