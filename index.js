const app = require('express')()
const server = require('http').createServer(app)
const { Server } = require('socket.io')

const io = new Server(server)

io.on('connection', socket => {

})

server.listen(3001)