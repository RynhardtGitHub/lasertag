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

app.get("/version",(req,res)=>{
    res.json({version: "0.1.0"});
})

io.on("connection", (socket) => {
    socket.emit("noArg");
    socket.emit("basicEmit", 1, "2", Buffer.from([3]));
    socket.emit("withAck", "4", (e) => {
        console.log("Ack from client:", e);
    });

    socket.on("create",(playerName)=>{
        // let newPlayer = createPlayer(socket.id,playerName,{isHost:true,isSpectator:false});

        let playerIdWhitelist = 'ABSK12345678';
        let playerId = makeid(2,playerIdWhitelist);
        while (assignedPlayerIds.includes(playerId)) { // Will cause infinite loop if too many players connect
            // Max number of players reached
            if (assignedPlayerIds.length >= Math.pow(playerIdWhitelist.length,2)) {
                return {
                    success: false,
                    error: true,
                    message: 'Maximum number of players reached',
                }
            }
            playerId = makeid(2,playerIdWhitelist);
        }
        let newPlayer = createPlayer(playerId,playerName,{isHost:true,isSpectator:false});
        assignedPlayerIds.push(playerId);
        console.log(`Created player with id: ${playerId}`)

        const roomID = makeid(6); 
        socket.join(roomID)
        roomsPlayers[roomID]=[newPlayer];

        socket.emit("sendRoom", roomID,[]);
    })

    socket.on("getRoomInfo",(roomID)=>{
        // Assuming that initRoom is only called after rendering the lobby page
        if (roomID==null){
            return;
        }
        const availRooms = getRooms();
        if (!availRooms.includes(roomID)){
            return;
        }

        const activePlayers= roomsPlayers[roomID].filter((p) => !p.isSpectator)

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

        if (!playerExists) {
            const newPlayer = createPlayer(socket.id, data.playerName, { isHost: false, isSpectator: false });
            roomsPlayers[data.gameID].push(newPlayer);
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
            const newSpec = createPlayer(socket.id,spectatorName, { isHost: false, isSpectator: true });
            roomsPlayers[data.gameID].push(newSpec);
        }

        if (typeof callback === "function") {
            callback({ success: true });
        }
        // io.to(data.gameID).emit("updateRoom", roomsPlayers[data.gameID])
    })

    socket.on("startGame", (gameID)=>{
        if (!roomsPlayers[gameID]) {
            return;
        }
        io.to(gameID).emit("readyUp", gameID);
    })

    // Also add disconnect socket
    // socket.on("erasePlayer", async (playerId) => {
    //     console.log(roomsPlayers)
    //     console.log(assignedPlayerIds)
    // })
});


httpServer.listen(port, () => {
    console.log(`HTTP + Socket.IO server running on port ${port}`);
});