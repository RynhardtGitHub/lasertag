"use client"

import { io, Socket } from "socket.io-client";

export class WebSocketClient {
  private socket: Socket;
  public id="";
  constructor() {
    //TODO CHANGE THE URL for server socket
    this.socket = io("https://lasertag.onrender.com/", {
      transports: ["websocket"], // optional, can fallback to polling if you remove this
    });

    // this.socket = io("http://localhost:3001", {
    //   transports: ["websocket"], // optional, can fallback to polling if you remove this
    // });


    this.socket.on("connect", () => {
      console.log(`Connected as ${this.socket.id}`);
      this.id = this.socket.id || "";

    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected");
      // this.socket.emit('erasePlayer',{})
    });
  }

  getId() {
    return this.id;
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket.on(event, callback);
  }

  once(event: string, callback: (...args: any[]) => void) {
    this.socket.once(event, callback);  // <== Add this
  }

  emit(event: string, data: any,callback?: (...args: any[]) => void) {
    this.socket.emit(event, data, callback);
  }

  off(event: string, callback: (...args: any[]) => void) {
    this.socket.off(event, callback);
  }

  disconnect() {
    this.socket.disconnect();
  }
}

const createWebSocket = () => {
  return new WebSocketClient();
};


let ws:WebSocketClient;

export function getWebSocket(): WebSocketClient {
  if (ws==null) {
    ws = createWebSocket()
  }

  return ws;
}

