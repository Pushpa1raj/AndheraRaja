import { create } from 'zustand'

interface WebSocketStore {
  socket: WebSocket | null
  connected: boolean
  rooms: Set<string>
  connect: (token: string) => void
  disconnect: () => void
  joinRoom: (roomId: string) => void
  leaveRoom: (roomId: string) => void
  sendMessage: (message: unknown) => void
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/api/v1/ws'

export const useWebSocket = create<WebSocketStore>((set, get) => ({
  socket: null,
  connected: false,
  rooms: new Set(),

  connect: (token: string) => {
    const ws = new WebSocket(`${WS_URL}/?token=${token}`)

    ws.onopen = () => {
      console.log('WebSocket connected')
      set({ connected: true })
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      set({ connected: false, socket: null })
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    set({ socket: ws })
  },

  disconnect: () => {
    const { socket } = get()
    if (socket) {
      socket.close()
      set({ socket: null, connected: false, rooms: new Set() })
    }
  },

  joinRoom: (roomId: string) => {
    const { socket, rooms } = get()
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action: 'join_room', room_id: roomId }))
      set({ rooms: new Set([...rooms, roomId]) })
    }
  },

  leaveRoom: (roomId: string) => {
    const { socket, rooms } = get()
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action: 'leave_room', room_id: roomId }))
      const newRooms = new Set(rooms)
      newRooms.delete(roomId)
      set({ rooms: newRooms })
    }
  },

  sendMessage: (message: unknown) => {
    const { socket } = get()
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  },
}))
