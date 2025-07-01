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
    res.json({version: "0.1.1"});
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

        while (assignedPlayerIds.includes(playerId)) { // Will cause infinite loop if too many players connect
            // Max number of players reached
            // if (assignedPlayerIds.length >= Math.pow(playerIdWhitelist.length,2)) {
            if (assignedPlayerIds.length >= Math.pow(3,2)) {
                return {
                    success: false,
                    error: true,
                    message: 'Maximum number of players reached',
                }
            }
            // playerId = makeid(2,playerIdWhitelist);
            playerId = makeid(1,numberWhitelist);
            playerId += makeid(1,letterWhitelist);
        }

        let newPlayer = createPlayer(socket.id,playerName,playerId,{isHost:true,isSpectator:false});
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

        // let playerIdWhitelist = 'APURM0123456789';
        // let playerId = makeid(2,playerIdWhitelist);

        /* Sus workaround to creating an id with one number and lettter */
        let playerId = makeid(1,numberWhitelist);
        playerId += makeid(1,letterWhitelist);

        while (assignedPlayerIds.includes(playerId)) { // Will cause infinite loop if too many players connect
            // Max number of players reached
            // if (assignedPlayerIds.length >= Math.pow(playerIdWhitelist.length,2)) {
            if (assignedPlayerIds.length >= Math.pow(3,2)) {
                return {
                    success: false,
                    error: true,
                    message: 'Maximum number of players reached',
                }
            }
            // playerId = makeid(2,playerIdWhitelist);
            playerId = makeid(1,numberWhitelist);
            playerId += makeid(1,letterWhitelist);
        }


        if (!playerExists) {
            const newPlayer = createPlayer(socket.id, data.playerName,playerId,{ isHost: false, isSpectator: false });
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
    socket.on("triggerEvent",(data)=>{
        if (data.eventType<0){
            return;
        }

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