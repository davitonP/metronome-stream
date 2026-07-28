import { ref } from 'vue'
import { io } from 'socket.io-client'

// Instancia única de socket compartida por toda la app.
// En dev, Vite proxynea /socket.io al backend; en prod se sirve desde el mismo origen.
const socket = io({ autoConnect: true })

const connected = ref(socket.connected)

socket.on('connect', () => {
  connected.value = true
})

socket.on('disconnect', () => {
  connected.value = false
})

export function useSocket() {
  return { socket, connected }
}
