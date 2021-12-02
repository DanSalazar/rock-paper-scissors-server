const app = require('express')()
const server = require('http').createServer(app)
require('dotenv').config()
const { v4: uuid } = require('uuid')
const { Server } = require('socket.io')
const PORT = process.env.PORT || 3001

const io = new Server(server, {
  cors: {
    origin: [process.env.APP_DOMAIN],
    methods: ['POST', 'GET']
  }
})

app.get('/', (req, res) => {
  res.send('Hello')
})

let rooms = []

io.on('connection', socket => {
  socket.on('new-room', ({ room, host, password }) => {
    const exists = roomExist(room)

    if (exists) {
      socket.emit('room-exist', { error: true, message: 'Room already exist' })
      return
    }

    if (room.length < 3) {
      socket.emit('room-too-short', { error: true, message: `Room name it's too short` })
      return
    }

    if (password.length < 3) {
      socket.emit('password-too-short', { error: true, message: `Password given it's too short` })
      return
    }

    socket.join(room)
    socket.room = room
    socket.user = host

    let newRoom = {
      name: room,
      id: uuid(),
      players: [host],
      password
    }

    rooms = rooms.concat(newRoom)
    socket.emit('new-room-created', newRoom)
  })

  socket.on('join-room', ({ room, guest, password }) => {
    const exist = roomExist(room)

    if (!exist) {
      socket.emit('room-not-exist', { error: true, message: 'Room not exist' })
      return
    }

    if (exist.password !== password) {
      socket.emit('incorrect-password', { error: true, message: 'Invalid password' })
      return
    }

    if (exist.players.length >= 2) {
      socket.emit('full-room', { error: true, message: 'Full room' })
      return
    }

    let roomEdit = {
      ...exist,
      players: [exist.players[0], guest]
    }

    updateRooms(roomEdit)
    socket.join(room)
    socket.room = room
    socket.user = guest
    socket.to(room).emit('player-joined', guest)
    socket.emit('joined', roomEdit)
  })
  
  socket.on('election', ({ value }) => {
    socket.to(socket.room).emit('op-selection', value)
  })

  socket.on('leave-room', () => {
    let exist = roomExist(socket.room)

    exist = {
      ...exist,
      players: exist.players.filter(player => player !== socket.user)
    }

    if (exist.players.length === 0) {
      socket.leave(socket.room)
      deleteRoom(socket.room)
      return
    }

    updateRooms(exist)
    socket.leave(socket.room)
    io.to(socket.room).emit('player-leave')

    socket.room = ''
    socket.user = ''
  })

  socket.on('disconnect', () => {
    deleteUserFromRoom(socket.room, socket.user)
    io.to(socket.room).emit('player-leave')
    socket.leave(socket.room)
    socket.room = ''
    socket.user = ''
  })
})

app.get('/rooms', (req, res) => {
  res.json({ rooms })
})

server.listen(PORT)

const roomExist = room => {
  return rooms.find(r => r.name === room)
}

const deleteRoom = room => {
  rooms = rooms.filter(r => r.name !== room)
}

const deleteUserFromRoom = (name, user) => {
  let room = roomExist(name)

  if (room) {
    room = {
      ...room,
      players: room.players.filter(player => player !== user)
    }
    updateRooms(room, room.id)
  }
}

const updateRooms = (roomUpdate, id) => {
  rooms = rooms.map(room => {
      if (room.id === roomUpdate.id) return roomUpdate
      return room
    })
}