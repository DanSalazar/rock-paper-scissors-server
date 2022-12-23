const app = require('express')()
const server = require('http').createServer(app)
require('dotenv').config()
const { v4: uuid } = require('uuid')
const { Server } = require('socket.io')
const PORT = process.env.PORT || 3001

const io = new Server(server, {
  cors: {
    origin: [process.env.CLIENT_DOMAIN, process.env.CLIENT_DEVELOPMENT],
    methods: ['POST', 'GET']
  }
})

let rooms = []

io.on('connection', socket => {
  socket.on('new-room', ({ room, host, password }) => {
    const roomExists = findRoom(room)

    if (typeof roomExists !== 'undefined') {
      socket.emit('error-room', { error: true, message: 'Room already exist' })
      return
    }

    if (room.length < 3) {
      socket.emit('error-room', { error: true, message: `Room name it's too short` })
      return
    }

    if (password.length < 3) {
      socket.emit('error-room', { error: true, message: `Password given it's too short` })
      return
    }

    socket.join(room)

    let newRoom = {
      name: room,
      id: uuid(),
      players: [host],
      password
    }

    socket.room = room
    socket.user = host

    rooms.push(newRoom)
    socket.emit('new-room-created', newRoom)
  })

  socket.on('join-room', ({ room, guest, password }) => {
    const currentRoom = findRoom(room)

    if (typeof currentRoom === 'undefined') {
      socket.emit('error-room', { error: true, message: 'Room not exist' })
      return
    }

    if (currentRoom.password !== password) {
      socket.emit('error-room', { error: true, message: 'Invalid password' })
      return
    }

    if (currentRoom.players.length >= 2) {
      socket.emit('error-room', { error: true, message: 'Full room' })
      return
    }

    currentRoom.players = [guest, currentRoom.players[0]]

    socket.join(room)

    socket.room = room
    socket.user = guest

    socket.to(room).emit('player-joined', guest)
    socket.emit('joined', currentRoom)
  })
  
  socket.on('election', value => {
    socket.to(socket.room).emit('op-selection', value)
  })

  socket.on('new-message', message => {
    socket.to(socket.room).emit('new-message', message)
  })

  socket.on('play-again', () => {
    socket.to(socket.room).emit('play-again')
  })
  
  socket.on('leave-room', () => {
    handleDisconnect(io, socket)
  })

  socket.on('disconnect', () => {
    handleDisconnect(io, socket)
  })
})

server.listen(PORT)

const findRoom = roomName => {
  return rooms.find(r => r.name === roomName)
}

const deleteRoom = id => {
  rooms = rooms.filter(r => r.id !== id)
}

const deleteUserFromRoom = (roomName, user) => {
  let room = findRoom(roomName)

  if (room) {
    room.players = room.players.filter(player => player !== user)

    if (room.players.length === 0) {
      deleteRoom(room.id)
      return
    }
  }
}

const handleDisconnect = (io, socket) => {
  deleteUserFromRoom(socket.room, socket.user)
  socket.leave(socket.room)
  io.to(socket.room).emit('player-leave', socket.user)
  socket.room = ''
  socket.user = ''
}