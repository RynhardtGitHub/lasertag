import express, { Request, Response } from "express";
import { createServer } from "http";
import {createNewServer} from "./socketsLogic";

const app = express();
const port = process.env.PORT || 3001;
const httpServer = createServer(app);
const io = createNewServer(httpServer);

app.get('/', (req: Request, res: Response) => {
    res.send('Hello from Express with TypeScript!');
});


app.get('/hello', (req: Request, res: Response) => {
    let json = {
        "data":231
    };
    res.send(json)
});

app.get("/createLobby",(req,res)=>{
    res.send({ lobby: "created" });
})

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
    });
});


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});