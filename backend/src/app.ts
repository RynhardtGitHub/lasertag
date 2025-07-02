import express, { Request, Response } from "express";
import { createServer } from "http";
import {createNewServer} from "./socketsLogic";
import cors from "cors";
import { makeid } from "./misc";
import { createPlayer } from "./misc";
import { Player } from "./types";

const app = express();
const port = process.env.PORT || 3001;
const httpServer = createServer(app);
const io = createNewServer(httpServer);

let roomsPlayers: { [key: string]: Array<Player> } = {}
let readyPlayers: { [key: string]: Array<String> } = {} //Array is player strings

let assignedPlayerIds: Array<string> = [];

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
        // let newPlayer = createPlayer(socket.id,playerName,{isHost:true,isSpectator:false});

        // let playerIdWhitelist = 'APURM0123456789';
        // let playerId = makeid(2,playerIdWhitelist);

        /* Sus workaround to creating an id with one number and lettter */
        let playerId = makeid(1,numberWhitelist);
        playerId += makeid(1,letterWhitelist);
        //TODO CHANGE BACK

        // playerId = "1"
        let newPlayer = createPlayer(socket.id,playerName,playerId,{isHost:true,isSpectator:false});
        console.log(`Created player with id: ${playerId}`)

        const roomID = makeid(6); 
        socket.join(roomID)
        roomsPlayers[roomID]=[newPlayer];

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
                playerId = makeid(1, numberWhitelist) + makeid(1, letterWhitelist);
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
    socket.on("triggerEvent",(data)=>{
        if (data.eventType<0){
            return;
        }
        switch (data.eventType) {
            case 0: // shoot event
                console.log("shoot him")
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

        console.log(roomsPlayers[gameID]);
    })

    // Also add disconnect socket
    // socket.on("erasePlayer", async (playerId) => {
    //     console.log(roomsPlayers)
    //     console.log(assignedPlayerIds)
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