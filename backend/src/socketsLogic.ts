import { Server } from "socket.io";
import { Server as HTTPServer } from "http";
import { JoinRoomResponse, Player } from "./types";

interface ServerToClientEvents {
  noArg: () => void;
  basicEmit: (a: number, b: string, c: Buffer) => void;
  withAck: (d: string, callback: (e: number) => void) => void;
  sendGameState : (players:Array<string>,gameID:string,gameStatus:number)=>void;
  sendRoom: (room:string,players:Array<string>)=>void;
  updateRoom : (players:Array<Player>)=>void;
}

interface ClientToServerEvents {
  hello: () => void;
  create: (playerName:string) => void;
  join : (data:{ gameID: string; playerName: string},callback:(res:JoinRoomResponse)=>void)=>void;
  getRoomInfo : (roomID:string)=>void;
  spectate:(data:{ gameID: string; playerName?: string},callback:(res:JoinRoomResponse)=>void)=>void;
  erasePlayer:(data:{playerId: string})=>void;
}

interface InterServerEvents {
  ping: () => void;
}

interface SocketData {
  data:JSON
}


export function createNewServer(httpServer:HTTPServer){
    const io = new Server<
        ClientToServerEvents,
        ServerToClientEvents,
        InterServerEvents,
        SocketData
    >(httpServer, {
      cors:{
        origin:["http://localhost:5500","http://localhost:3004"],
        methods: ["GET", "POST"]
      }
    });

    return io;
}
