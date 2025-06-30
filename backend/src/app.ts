import express, { Request, Response } from "express";
import { createServer } from "http";
import {createNewServer} from "./socketsLogic";
import cors from "cors";

const app = express();
const port = process.env.PORT || 3000;
const httpServer = createServer(app);
const io = createNewServer(httpServer);


app.use(cors());


app.get('/', (req: Request, res: Response) => {
    res.send('Hello from Express with TypeScript!');
});

app.get("/createLobby",(req,res)=>{
    res.send({ lobby: "created" });
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


    // works when broadcast to all
    io.emit("noArg");

    // works when broadcasting to a room
    io.to("room1").emit("basicEmit", 1, "2", Buffer.from([3]));

    socket.on("hello",()=>{
        console.log("Received 'hello' from client");
        socket.emit("noArg");
    });
});

httpServer.listen(port, () => {
    console.log(`HTTP + Socket.IO server running on port ${port}`);
});