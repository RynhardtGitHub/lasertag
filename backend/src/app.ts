import express, { Request, Response } from "express";
import { createServer } from "http";
import {createNewServer} from "./socketsLogic";
import { createPlayer,makeid } from "./misc";
import { Player,TriggerEventPayload } from "./types";
import cors from "cors";

// constants
const app = express();
const port = process.env.PORT || 3001;
const httpServer = createServer(app);
const io = createNewServer(httpServer);

//Tracking some information
let roomsPlayers: { [key: string]: Array<Player> } = {}
let roomTimers: {[key:string] : number} = {};
let roomIntervals: { [key: string]: NodeJS.Timeout } = {};
let defaultTime = 300;

// Middleware
app.use(cors());
app.use(express.json());


//Functions 
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


//Routes
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
    res.json({version: "1.1.2"});
})

//Socket
io.on("connection", (socket) => {
    socket.emit("noArg");
    socket.emit("basicEmit", 1, "2", Buffer.from([3]));
    socket.emit("withAck", "4", (e) => {
        console.log("Ack from client:", e);
    });

    let maxPlayers = 8;

    socket.on("create",(data)=>{
        let newPlayer = createPlayer(socket.id,data.playerName,data.shirtColor,{isHost:true,isSpectator:false});
        console.log(`Created player with id: ${data.shirtColor}`)

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

        activePlayers.forEach((player:Player, index:number) => {
            console.log("Player in room:", player.shootId, "isAlive:", player.isAlive, "respawnScheduled:",
                player.respawnScheduled, "health:", player.health);


            if (player.health <=0) {
                console.log(`Scheduling respawn for player ${player.shootId} in room ${roomID}`);
                player.respawnScheduled = true; // Prevent multiple timers
                setTimeout(() => {
                    player.isAlive = true;
                    player.respawnScheduled = false;
                    player.health = 100; // Reset health on respawn
                    console.log(`Player ${player.shootId} respawned in room ${roomID}`);

                    // Optional: emit update to all clients after respawn
                    const activePlayers = roomsPlayers[roomID].filter((p) => !p.isSpectator);
                    io.to(roomID).emit("updateRoom", activePlayers);
                }, 3000); // 3 seconds
                }
            });
        
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
            // if (players.length >= numberWhitelist.length * letterWhitelist.length){
            if (players.length >= maxPlayers){
                console.warn(`Max players for game ${data.gameID} reached`);
                if (typeof callback === "function") {
                    callback({ success: false, message: "Room is full." });
                }
                return;
            }

            const newPlayer = createPlayer(socket.id, data.playerName,data.shirtColor,{ isHost: false, isSpectator: false });
            roomsPlayers[data.gameID].push(newPlayer);
            console.log(`New player joined with shirtColor: ${data.shirtColor}`)
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

        if (!roomsPlayers[data.gameID]) {
            roomsPlayers[data.gameID] = [];
        }

        let spectatorName = data.playerName || "";

        const newSpec = createPlayer(socket.id, spectatorName, "", { isHost: false, isSpectator: true });
        roomsPlayers[data.gameID].push(newSpec);

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
                const shooter = roomsPlayers[data.gameID].find(p => p.shootId === shooterId);

                if (!shooter?.isAlive) return;

                // Decrease player health
                const updatedPlayers = roomsPlayers[data.gameID].map(p => {
                    // hit the victim
                    if (p.shootId === victimId) {
                      const newHealth = Math.max(p.health - damage,0);

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
                
                //check if any players died
                if (victimId) {
                  const victim = updatedPlayers.find(p => p.shootId === victimId);
                  if (victim && victim.health <= 0) {
                    victim.respawnScheduled = true
                    console.log(`Player ${victimId} has died.`);
                  }
                
                  roomsPlayers[data.gameID] = updatedPlayers;

                  if (roomsPlayers[data.gameID]) {
                    const alivePlayersCount = roomsPlayers[data.gameID].filter(p => p.isAlive).length;
                    console.log(`Alive players in game ${data.gameID}: ${alivePlayersCount}`);

                    if (alivePlayersCount <= 1) { // If 1 or 0 players are alive (0 could happen if last two die simultaneously)
                        console.log(`Game ${data.gameID} ending: Only ${alivePlayersCount} player(s) remaining.`);
                        // io.to(data.gameID).emit("endSession");
                        //delete roomsPlayers[data.gameID];
                    }
                  }
                }
                break;
            case 1: // heal event
                let healAmount = data.eventData.healAmount || 20; // Default heal amount=20
                let playerId = data.eventData.playerId;
                const playerToHeal = roomsPlayers[data.gameID].find(p => p.shootId === playerId);

                if (!playerToHeal?.isAlive) return;

                // Increase player health
                const updatedHealthPlayers = roomsPlayers[data.gameID].map(p => {
                    if (p.shootId === playerId) {
                        const newHealth = Math.max(p.health + healAmount, 100); // Assuming max health is 100
                        return {
                            ...p,
                            health: newHealth,
                            isAlive: newHealth > 0
                        };
                    }
                    return p;
                });

                roomsPlayers[data.gameID] = updatedHealthPlayers;
                io.to(data.gameID).emit("updateRoom", updatedHealthPlayers);
                break;
        
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

    // socket.on('endGame', (gameID)=>{
    //     io.to(gameID).emit('endSession');
    // });

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

    //streaming
    socket.on("playerReadyForStream", ({ gameId }) => {
        socket.join(gameId);
        socket.data.role = "player";
        socket.data.gameId = gameId;
        console.log(`Player ${socket.id} ready to stream in game ${gameId}`);
    });

    // Spectator joins the game room
    socket.on("spectatorJoin", ({ gameId }) => {
        socket.join(gameId);
        socket.data.role = "spectator";
        socket.data.gameId = gameId;
        console.log(`Spectator ${socket.id} joined game ${gameId}`);

        // Method 1: Notify all players that a spectator connected (hyphenated version for game client)
        socket.to(gameId).emit("spectator-connected", socket.id);
        
        // Method 2: Also request offers from all players (alternative approach)
        const room = io.sockets.adapter.rooms.get(gameId);
        if (room) {
            for (const socketId of room) {
                const peer = io.sockets.sockets.get(socketId);
                if (peer?.data.role === "player" && socketId !== socket.id) {
                    console.log(`Requesting offer from player ${socketId} for spectator ${socket.id}`);
                    peer.emit("requestOffer", { spectatorId: socket.id });
                }
            }
        }
    });

    // Player sends WebRTC offer to spectator
    socket.on("webrtcOffer", ({ to, from, sdp, gameId }) => {
        console.log(`Relaying WebRTC offer from ${from} to ${to} in game ${gameId || 'unknown'}`);
        io.to(to).emit("offerFromPlayer", { 
            offer: sdp, 
            from: from || socket.id 
        });
    });

    // Spectator sends WebRTC answer to player
    socket.on("webrtcAnswer", ({ to, sdp }) => {
        console.log(`Relaying WebRTC answer from ${socket.id} to ${to}`);
        io.to(to).emit("webrtcAnswer", { 
            answer: sdp, 
            from: socket.id 
        });
    });

    // Alternative answer event (in case spectate page uses different event name)
    socket.on("sendAnswer", ({ answer, to }) => {
        console.log(`Relaying answer (via sendAnswer) from ${socket.id} to ${to}`);
        io.to(to).emit("webrtcAnswer", { 
            answer: answer, 
            from: socket.id 
        });
    });

    // ICE candidates exchange (bidirectional)
    socket.on("webrtcCandidate", ({ to, candidate }) => {
        console.log(`Relaying ICE candidate from ${socket.id} to ${to}`);
        io.to(to).emit("webrtcCandidate", { 
            candidate, 
            from: socket.id 
        });
    });


});


httpServer.listen(port, () => {
    console.log(`HTTP + Socket.IO server running on port ${port}`);
});
