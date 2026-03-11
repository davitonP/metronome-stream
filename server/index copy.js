import express from 'express';
import logger from 'morgan'
import fs from 'fs'
import timeSync from 'precise-time-ntp';


import { Server } from 'socket.io';
import { createServer, get } from 'node:http';
import { time } from 'node:console';

const port = process.env.PORT ?? 3000

const app = express()
app.use(logger('dev'))
app.use(express.static(process.cwd() + '/public'))

const server = createServer(app)
const io = new Server(server)




// timeSync.setSmoothCorrection(true, {
//     maxCorrectionJump: 1000,     // Max 1s instant jump (larger jumps are gradual)
//     correctionRate: 0.1,         // 10% gradual correction per sync cycle
//     maxOffsetThreshold: 5000     // Force instant correction if >5s off (emergency)
// });

// await timeSync.sync({ 
//     coherenceValidation: true    // Validate server consistency for accuracy
// });

// timeSync.startAutoSync(5000);

// // Monitor when correction completes
// timeSync.on('correctionComplete', (data) => {
//     console.log(`🎯 Correction completed: ${data.finalOffset}ms`);
//     if (data.converged) console.log('Perfect precision achieved');
// });


app.get('/', (req, res) => {
    // res.send("Este es el stream")
    res.sendFile(process.cwd() + '/public/index.html')
})

app.get('/timeSync', (req, res) => {
    res.sendFile(process.cwd() + '/public/timeSync.html')
})

app.get('/master', (req, res) => {
    res.sendFile(process.cwd() + '/public/master.html')
})

app.get('/audioList', function(req, res) {
  const path = process.cwd() + '/public/assets/secuencias'
  const files = fs.readdirSync(path)
  res.send(files)
})
// Endpoint para listar archivos MP3
app.get('/songs', (req, res) => {
  const secuenciasPath = process.cwd() + '/public/assets/secuencias/'
  
  fs.readdir(secuenciasPath, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Error leyendo directorio' })
    }
    
    const mp3Files = files.filter(file => file.toLowerCase().endsWith('.mp3'))
    console.log(mp3Files)
    return res.status(200).json(mp3Files)
  })
})

// Endpoint para servir archivos de audio
app.get('/audio/:filename', function(req, res) {
  const filename = req.params.filename
  const path = process.cwd() + '/public/assets/secuencias/' + filename
  
  if (!fs.existsSync(path)) {
    return res.status(404).send('Archivo no encontrado')
  }
  
  const stat = fs.statSync(path)
  const fileSize = stat.size
  const range = req.headers.range

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-")
    const start = parseInt(parts[0], 10)
    const end = parts[1]
      ? parseInt(parts[1], 10)
      : fileSize-1

    if(start >= fileSize) {
      res.status(416).send('Requested range not satisfiable\n'+start+' >= '+fileSize);
      return
    }
    
    const chunksize = (end-start)+1
    const file = fs.createReadStream(path, {start, end})
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'audio/mpeg',
    }

    res.writeHead(206, head)
    file.pipe(res)
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'audio/mpeg',
    }
    res.writeHead(200, head)
    fs.createReadStream(path).pipe(res)
  }
})

app.get('/video', function(req, res) {
  const path = process.cwd() + '/public/assets/secuencias/prueba.mp4'
  const stat = fs.statSync(path)
  const fileSize = stat.size
  const range = req.headers.range

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-")
    const start = parseInt(parts[0], 10)
    const end = parts[1]
      ? parseInt(parts[1], 10)
      : fileSize-1

    if(start >= fileSize) {
      res.status(416).send('Requested range not satisfiable\n'+start+' >= '+fileSize);
      return
    }
    
    const chunksize = (end-start)+1
    const file = fs.createReadStream(path, {start, end})
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    }

    res.writeHead(206, head)
    file.pipe(res)
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    }
    res.writeHead(200, head)
    fs.createReadStream(path).pipe(res)
  }
})


server.listen(port, ()=>{
    console.log("The server is running")
})


io.on('connection', (socket) => {
  console.log("un nuevo usuario conectado")

  socket.on('disconnect', socket => {
    console.log("Se ha ido un usuario")
  })

  // Sincronización de tiempo NTP-like
  socket.on('time-sync', (clientTime) => {
    const serverTime = Date.now()
    socket.emit('time-sync-response', {
      clientTime: clientTime,
      serverTime: serverTime
    })
  })

  socket.on('start', (data) => {
    console.log("▶ Comenzando secuencia")
    console.log("  Canción:", data.song)
    let now = new Date()
    let startTime = new Date(now.getTime() + 1000)
    console.log("  Inicio programado:", startTime)
    io.emit('start', {
      startTime: startTime.getTime(),
      song: data.song
    })
  })

  socket.on('pause', socket => {
    console.log("Pausando secuencia")
    let now = new Date()
    let startTime = new Date(now.getTime() + 500) // 300ms para que todos esten listos
    console.log("La secuencia pausara a las: ", startTime)
    io.emit('pause', startTime.getTime())
  })

  socket.on('song-selected', (song) => {
    console.log("Canción seleccionada:", song)
    // Emitir a todos los clientes (incluyendo el que la seleccionó)
    io.emit('song-selected', song)
  })
})


