import { Server } from "socket.io";
import { Server as HTTPServer } from "http";
import { JoinRoomResponse, Player, SocketData } from "./types";


// Define the events for the server to client communication
interface ServerToClientEvents {
  noArg: () => void;
  basicEmit: (a: number, b: string, c: Buffer) => void;
  withAck: (d: string, callback: (e: number) => void) => void;

  //room logic
  sendRoom: (room:string,players:Array<string>)=>void;
  updateRoom : (players:Array<Player>)=>void;

  //start game logic
  readyUp: (gameID:string)=>void;
  sendGameState : (players:Array<string>,gameID:string,gameStatus:number)=>void;

  //time logic
  updateTimer: (timerVal:number)=>void;

  //end game logic
  endSession: ()=>void;
  
  //WebRTC events
  requestOffer: (data: { spectatorId: string }) => void; // Fixed: should be spectatorId
  offerFromPlayer: (data: { offer: RTCSessionDescriptionInit; from: string }) => void;
  receiveAnswer: (data: { answer: RTCSessionDescriptionInit; from: string }) => void; // Keep for backward compatibility
  webrtcAnswer: (data: { answer: RTCSessionDescriptionInit; from: string }) => void; // Added: what clients expect
  iceCandidate: (data: { candidate: RTCIceCandidateInit; from: string }) => void;
  webrtcCandidate: (data: { candidate: RTCIceCandidateInit; from: string }) => void; // Added: what clients expect
  spectatorConnected: (spectatorId: string) => void; // Fixed: changed from hyphenated version
  "spectator-connected": (spectatorId: string) => void; // Added: what game client expects

}


// Define the events for the client to server communication
interface ClientToServerEvents {
  hello: () => void;

  //room logic
  create: (data:{playerName:string, shirtColor: string}) => void;
  join : (data:{ gameID: string; playerName: string, shirtColor: string},callback:(res:JoinRoomResponse)=>void)=>void;
  getRoomInfo : (roomID:string,  callback?: (response: any) => void)=>void;
  spectate:(data:{ gameID: string; playerName?: string},callback:(res:JoinRoomResponse)=>void)=>void;

  //start game logic
  startGame: (gameID:string)=>void;
  startGameMessageRecievied: (gameID:string,playerID:string)=>void;
  endGame : (gameID:string)=>void;

  //game logic
  triggerEvent:(data:{gameID:string,eventType:number,eventData:JSON})=>void
  //disconnect
  erasePlayer:(data:{playerId: string})=>void;

  //WebRTC events
  playerReadyForStream: (data: { gameId: string }) => void;
  spectatorJoin: (data: { gameId: string }) => void;
  webrtcOffer: (data: { to: string; from: string; sdp: RTCSessionDescriptionInit; gameId?: string }) => void;
  webrtcAnswer: (data: { to: string; sdp: RTCSessionDescriptionInit }) => void;
  webrtcCandidate: (data: { to: string; candidate: RTCIceCandidateInit }) => void;
  
  // Additional events that might be used
  sendAnswer: (data: { answer: RTCSessionDescriptionInit; to: string }) => void;
}


// Define the events for inter-server communication
interface InterServerEvents {
  ping: () => void;
}


// createNewServer function to initialize a new Socket.IO server
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
