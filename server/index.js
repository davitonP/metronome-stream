import express from 'express';
import logger from 'morgan'
import fs from 'fs'
import timeSync from 'precise-time-ntp';

import { Server } from 'socket.io';
import { createServer, get } from 'node:http';


const port = process.env.PORT ?? 3000

const app = express()
app.use(logger('dev'))
app.use(express.static(process.cwd() + '/public'))

const server = createServer(app)
const io = new Server(server)

let activeTimer = null;


timeSync.setSmoothCorrection(true, {
    maxCorrectionJump: 1000,     // Max 1s instant jump (larger jumps are gradual)
    correctionRate: 0.1,         // 10% gradual correction per sync cycle
    maxOffsetThreshold: 5000     // Force instant correction if >5s off (emergency)
});

await timeSync.sync({ 
    coherenceValidation: true    // Validate server consistency for accuracy
});

timeSync.startAutoSync(5000);

// Monitor when correction completes
timeSync.on('correctionComplete', (data) => {
    console.log(`🎯 Correction completed: ${data.finalOffset}ms`);
    if (data.converged) console.log('Perfect precision achieved');
});


app.get('/', (req, res) => {
    // res.send("Este es el stream")
    res.sendFile(process.cwd() + '/public/metronome.html')
    // res.sendFile(process.cwd() + '/public/index.html')
})

app.get('/timeSync', (req, res) => {
    res.sendFile(process.cwd() + '/public/timeSync.html')
})

app.get('/metronome', (req, res) => {
    res.sendFile(process.cwd() + '/public/metronome.html')
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


server.listen(port, ()=>{
    console.log("The server is running")
})


const sessions = {}; // { sessionId: { metronome: { ... }, timer: { ... } } }

io.on('connection', (socket) => {
  console.log("un nuevo usuario conectado")

  socket.on('disconnect', socket => {
    console.log("Se ha ido un usuario")
  })

  // Sincronización de tiempo NTP-like
  socket.on('time-sync', (clientTime) => {
    const ntpNow = timeSync.now();
    const serverTime = Number.isFinite(ntpNow) ? ntpNow : Date.now();
    socket.emit('time-sync-response', {
      clientTime: clientTime,
      serverTime: serverTime
    })
  })

  socket.on('join-session', (sessionId) => {
    // Leave previous rooms (except the default private room which is the socket.id)
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.leave(room);
        console.log(`Socket left session: ${room}`);
      }
    }

    socket.join(sessionId);
    console.log(`Socket joined session: ${sessionId}`);

    // Send current state of the session to the new user
    if (sessions[sessionId]) {
      const { metronome, timer } = sessions[sessionId];
      
      const now = timeSync.now();

      if (metronome) {
        if (now < metronome.startAt + metronome.durationMs) {
             socket.emit('metronome-start', metronome);
        } else {
             sessions[sessionId].metronome = null; 
        }
      }

      if (timer) {
        if (now < timer.startAt + timer.durationMs) {
             socket.emit('timer-start', timer);
        } else {
             sessions[sessionId].timer = null;
        }
      }
    }
  });

  socket.on('timer-start', ({ durationMs, sessionId }) => {
    const safeDuration = Number.isFinite(durationMs) ? durationMs : 10000;
    const ntpNow = timeSync.now();
    const baseNow = Number.isFinite(ntpNow) ? ntpNow : Date.now();
    const startAt = baseNow + 1000;
    console.log(`Iniciando timer en ${sessionId}: ${safeDuration}ms`);

    const timerData = { 
      startAt,
      durationMs: safeDuration,
    };

    if (!sessions[sessionId]) sessions[sessionId] = {};
    sessions[sessionId].timer = timerData;

    if (sessionId) {
        io.to(sessionId).emit('timer-start', timerData);
    } else {
        // Fallback for legacy/global (though we should encourage sessions)
        io.emit('timer-start', timerData); 
    }
  })

  socket.on('metronome-start', ({ bpm, durationMs, sessionId }) => {
    const safeBpm = Number.isFinite(bpm) ? bpm : 90;
    const safeDuration = Number.isFinite(durationMs) ? durationMs : 10000;
    
    // Server assigns start time
    const ntpNow = timeSync.now();
    const baseNow = Number.isFinite(ntpNow) ? ntpNow : Date.now();
    const startAt = baseNow + 2000; // Start in 2 seconds for better mobile sync

    const metronomeSetting = { 
      bpm: safeBpm,
      startAt: startAt,
      durationMs: safeDuration,
    };
    
    console.log(`Broadcasting metronome-start to ${sessionId}:`, metronomeSetting);

    if (!sessions[sessionId]) sessions[sessionId] = {};
    sessions[sessionId].metronome = metronomeSetting;

    if (sessionId) {
        io.to(sessionId).emit('metronome-start', metronomeSetting);
    } else {
         io.emit('metronome-start', metronomeSetting);
    }
  })

  socket.on('metronome-stop', ({ sessionId }) => {
    console.log(`Broadcasting metronome-stop to ${sessionId}`);
    
    if (sessions[sessionId]) {
        sessions[sessionId].metronome = null;
    }

    if (sessionId) {
        io.to(sessionId).emit('metronome-stop');
    } else {
        io.emit('metronome-stop');
    }
  })

})


