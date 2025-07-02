import express, { Request, Response } from "express";
import { createServer } from "http";
import {createNewServer} from "./socketsLogic";
import cors from "cors";
import { makeid } from "./misc";
import { createPlayer } from "./misc";
import { Player } from "./types";
import { defaultMaxListeners } from "events";

const app = express();
const port = process.env.PORT || 3001;
const httpServer = createServer(app);
const io = createNewServer(httpServer);

let roomsPlayers: { [key: string]: Array<Player> } = {}
let roomTimers: {[key:string] : number} = {};
let roomIntervals: { [key: string]: NodeJS.Timeout } = {};
let defaultTime = 300;

app.use(cors());
app.use(express.json());

function getRooms(){
    const rooms = io.sockets.adapter.rooms;
    const filteredRooms = [];

    for (const [roomID, socketsSet] of rooms) {
        if (!io.sockets.sockets.has(roomID)) {
            filteredRooms.push(roomID);
        }
    }
    return filteredRooms
}

export interface TriggerEventPayload {
    gameID: string,
    eventType: number;
    eventData: {
      weapon?: {
        name: string;
        damage: number;
        range: number;
      },
      [key: string]: any;
    };
  }

app.get('/', (req: Request, res: Response) => {
    res.send('Hello from Express with TypeScript!');
});


app.get("/getLobbies",(req,res)=>{
    res.json(getRooms());
})

app.get("/getRooms",(req,res)=>{
    res.json(roomsPlayers);
})

app.get("/weapons",(req,res)=>{
    const weapons = [
        { name: "Knife", damage: 5, range: 25 },
        { name: "Basic Pistol", damage: 5, range: 50 },
        { name: "Shotgun", damage: 15, range: 75 },
        { name: "Rocket Launcher", damage: 30, range: 200 },
    ];
    res.json(weapons);
});


app.get("/version",(req,res)=>{
    res.json({version: "0.1.2"});
})

io.on("connection", (socket) => {
    socket.emit("noArg");
    socket.emit("basicEmit", 1, "2", Buffer.from([3]));
    socket.emit("withAck", "4", (e) => {
        console.log("Ack from client:", e);
    });

    let numberWhitelist = '123';
    let letterWhitelist = 'APU';

    socket.on("create",(playerName)=>{
        let playerId = makeid(1,numberWhitelist);
        // playerId += makeid(1,letterWhitelist);
        //TODO CHANGE BACK

        // playerId = "1"
        let newPlayer = createPlayer(socket.id,playerName,playerId,{isHost:true,isSpectator:false});
        console.log(`Created player with id: ${playerId}`)

        const roomID = makeid(6);
        socket.join(roomID)
        roomsPlayers[roomID]=[newPlayer];
        roomTimers[roomID] = defaultTime;

        socket.emit("sendRoom", roomID,[]);
    })

    socket.on("getRoomInfo",(roomID, callback)=>{
        // Assuming that initRoom is only called after rendering the lobby page
        if (roomID==null){
            return;
        }
        const availRooms = getRooms();
        if (!availRooms.includes(roomID)){
            return;
        }

        const activePlayers= roomsPlayers[roomID].filter((p) => !p.isSpectator)
        
        if (callback) {
            callback({ success: true, activePlayers }); // ✅ only call if it exists
        }

        io.to(roomID).emit("updateRoom", activePlayers)
    })

    socket.on("join",async (data,callback)=>{
        const availRooms = getRooms();
        
        if (!availRooms.includes(data.gameID)){
             if (typeof callback === "function") {
                callback({ success: false, message: "Invalid room ID" });
            }
            return
        }

        socket.join(data.gameID);

        let playerExists = false;

        if (!roomsPlayers[data.gameID]) {
            roomsPlayers[data.gameID] = [];
        }

        playerExists = roomsPlayers[data.gameID].some((p) => p.id === socket.id);

        // let playerIdWhitelist = 'APURM0123456789';
        // let playerId = makeid(2,playerIdWhitelist);

        if (!playerExists) {
            const players = roomsPlayers[data.gameID];
            if (players.length >= numberWhitelist.length * letterWhitelist.length){
                console.warn(`Max players for game ${data.gameID} reached`);
                if (typeof callback === "function") {
                    callback({ success: false, message: "Room is full." });
                }
                return;
            }
            const idExists = (id: string) => players.some(p => p.shootId === id);
            let playerId;
            do {
                playerId = makeid(1, numberWhitelist);
            } while (idExists(playerId));

            const newPlayer = createPlayer(socket.id, data.playerName,playerId,{ isHost: false, isSpectator: false });
            roomsPlayers[data.gameID].push(newPlayer);
            console.log(`New player joined with ID: ${playerId}`)
        }

        if (typeof callback === "function") {
            callback({ success: true });
        }

        const activePlayers= roomsPlayers[data.gameID].filter((p) => !p.isSpectator)
        io.to(data.gameID).emit("updateRoom", activePlayers)

    })

    socket.on("spectate",async (data,callback)=>{
        const availRooms = getRooms();
        
        if (!availRooms.includes(data.gameID)){
             if (typeof callback === "function") {
                callback({ success: false, message: "Invalid room ID" });
            }
            return
        }

        socket.join(data.gameID);

        let playerExists = false;

        if (!roomsPlayers[data.gameID]) {
            roomsPlayers[data.gameID] = [];
        }

        let spectatorName;

        if (data.playerName==undefined){
            spectatorName = "";
        }else{
            spectatorName = data.playerName;
        }

        if (!playerExists) {
            const newSpec = createPlayer(socket.id,spectatorName,"", { isHost: false, isSpectator: true });
            roomsPlayers[data.gameID].push(newSpec);
        }

        if (typeof callback === "function") {
            callback({ success: true });
        }
        // io.to(data.gameID).emit("updateRoom", roomsPlayers[data.gameID])
    })


    /**
     * EVENTTYPES
     * 0 => shoot
     * 1 => heal
     * 2 => ...
     */
    socket.on("triggerEvent",(data: TriggerEventPayload)=>{
        if (data.eventType<0){
            return;
        }

        console.log('eventData')
        console.log(data.eventData)

        switch (data.eventType) {
            case 0: // shoot event
                let damage = data.eventData.weapon?.damage || 10; // Default damage=10
                let victimId = data.eventData.victim;
                let shooterId = data.eventData.shooter;

                // Decrease player health
                const updatedPlayers = roomsPlayers[data.gameID].map(p => {
                    // hit the victim
                    if (p.shootId === victimId) {
                      const newHealth = p.health - damage;

                      console.log(`Hit player: ${victimId}`)
                      return {
                        ...p,
                        health: newHealth,
                        isAlive: newHealth > 0
                      };
                    }
                    // reward the shooter
                    if (p.shootId === shooterId) {
                        console.log(`${shooterId} points: ${p.score + 5}`)
                      return {
                        ...p,
                        score: p.score + 5
                      };
                    }
                    // everyone else stays the same
                    return p;
                  });
                  roomsPlayers[data.gameID] = updatedPlayers;

                break;

            case 1: // heal event
                console.log("heal")
        
            default:
                break;
        }
    })

    socket.on("startGame", (gameID)=>{
        if (!roomsPlayers[gameID]) {
            return;
        }
        io.to(gameID).emit("readyUp", gameID);

        roomIntervals[gameID] = setInterval(() => {
            if (roomTimers[gameID] > 0) {
              roomTimers[gameID]--;
        
              // Optionally: emit updated time to clients
              io.to(gameID).emit("updateTimer", roomTimers[gameID]);
            } else {
              clearInterval(roomIntervals[gameID]);
              delete roomIntervals[gameID];
              console.log(`Timer for room ${gameID} ended.`);
              
              io.to(gameID).emit("endSession");
            }
          }, 1000); // every second
    })

    socket.on('endGame', (gameID)=>{
        io.to(gameID).emit('endSession');
    });

    // Also add disconnect socket
    // socket.on("erasePlayer", async (playerId) => {
    //     console.log(roomsPlayers)
    //     console.log(assignedPlayerIds)
    // })

    //  socket.on("misc", (currPlayerId)=>{
    //     //ranodm number 
    //     const randomNumber = Math.floor(Math.random() * 2) + 1;

    //     //case statment to determine which power up
    //     switch(randomNumber) {
    //         case 1:     //increased health
    //             if (currentRoomID){
    //                 let shooter = roomsPlayers[currentRoomID]?.find(
    //                     (player) => player.id === currPlayerId
    //                 );
                    
    //                 if (shooter){
    //                     shooter.health = 100;
    //                     console.log("H " + shooter.health);
    //                 }
                    
    //             }
    //         case 2:
    //             case 1:     //weapon change
    //             if (currentRoomID){
    //                 let shooter = roomsPlayers[currentRoomID]?.find(
    //                     (player) => player.id === currPlayerId
    //                 );
                    
    //                 if (shooter){
    //                     shooter.weapon = Arsenal[Math.floor(Math.random() * 3) + 0];
    //                     console.log("W " + shooter.weapon);
    //                 }
                    
    //             }    
    //     }
    //     if(currentRoomID)
    //     {
    //         io.to(currentRoomID).emit("updateRoom", roomsPlayers[currentRoomID]);
    //     }
    // })
});


httpServer.listen(port, () => {
    console.log(`HTTP + Socket.IO server running on port ${port}`);
});