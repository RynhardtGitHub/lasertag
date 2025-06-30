"use client"

// Mock WebSocket implementation for demonstration
// In a real app, you'd use Socket.IO or Ably

export class MockWebSocket {
  private listeners: { [key: string]: Function[] } = {}
  private gameId: string

  constructor(gameId: string) {
    this.gameId = gameId
  }

  on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  emit(event: string, data: any) {
    // Simulate network delay
    setTimeout(() => {
      if (this.listeners[event]) {
        this.listeners[event].forEach((callback) => callback(data))
      }
    }, 100)
  }

  off(event: string, callback: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback)
    }
  }

  disconnect() {
    this.listeners = {}
  }
}

export const createWebSocket = (gameId: string) => {
  return new MockWebSocket(gameId)
}
