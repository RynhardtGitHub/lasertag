import { Server } from "socket.io";
import { Server as HTTPServer } from "http";
import { JoinRoomResponse, Player, GameEventData } from "./types";


interface ServerToClientEvents {
  noArg: () => void;
  basicEmit: (a: number, b: string, c: Buffer) => void;
  withAck: (d: string, callback: (e: number) => void) => void;

  //room logic
  sendRoom: (room:string,players:Array<string>)=>void;
  updateRoom : (players:Array<Player>)=>void;

  //start game logic
  readyUp: (gameID:string)=>void;

  //game logic
  sendGameState : (data:{gameID:string,gameData:object})=>void;

}


interface ClientToServerEvents {
  hello: () => void;
  //room logic
  create: (playerName:string) => void;
  join : (data:{ gameID: string; playerName: string},callback:(res:JoinRoomResponse)=>void)=>void;
  getRoomInfo : (roomID:string,  callback?: (response: any) => void)=>void;
  spectate:(data:{ gameID: string; playerName?: string},callback:(res:JoinRoomResponse)=>void)=>void;

  //start/end game logic
  startGame: (gameID:string)=>void;
  endGame : (gameID:string)=>void;

  //game logic
  triggerEvent:(data:{gameID:string,eventType:number,eventData:GameEventData})=>void

  //disconnect
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
        origin:["http://localhost:5500","http://localhost:3000",
        "https://lasertag.vercel.app/"],
        methods: ["GET", "POST"]
      }
    });

    return io;
}
