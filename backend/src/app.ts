import express, { Request, Response } from "express";
import { createServer } from "http";
import {createNewServer} from "./socketsLogic";
import cors from "cors";
import { makeid } from "./misc";

const app = express();
const port = process.env.PORT || 3001;
const httpServer = createServer(app);
const io = createNewServer(httpServer);


app.use(cors());


app.get('/', (req: Request, res: Response) => {
    res.send('Hello from Express with TypeScript!');
});

app.get("/getLobbies",(req,res)=>{
    const rooms = io.sockets.adapter.rooms;
    const filteredRooms = [];

    for (const [roomID, socketsSet] of rooms) {
        // If the roomID is also a socket id, skip it (because every socket automatically joins a room with its own id)
        if (!io.sockets.sockets.has(roomID)) {
            filteredRooms.push(roomID);
    }
    }

    res.json(filteredRooms);

})


// app.listen(port, () => {
//     console.log(`Server running on port ${port}`);
// });

io.on("connection", (socket) => {
    socket.emit("noArg");
    socket.emit("basicEmit", 1, "2", Buffer.from([3]));
    socket.emit("withAck", "4", (e) => {
        console.log("Ack from client:", e);
    });

    socket.on("hello",()=>{
        console.log("Received 'hello' from client");
        socket.emit("noArg");
    });

    socket.on("create",()=>{
        const roomID = makeid(6); 
        socket.join(roomID)
        console.log(io.sockets.adapter.rooms)
        socket.emit("sendRoom", roomID);
    })
});

httpServer.listen(port, () => {
    console.log(`HTTP + Socket.IO server running on port ${port}`);
});