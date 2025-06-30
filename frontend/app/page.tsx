"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, Users, Eye } from "lucide-react"
import { useRouter } from "next/navigation"
import { getWebSocket } from "@/lib/websocket"

export default function HomePage() {
  const [playerName, setPlayerName] = useState("")
  const [players, setPlayers] = useState<string[]>([]);
  const [gameId, setGameId] = useState("")
  const router = useRouter()
  const webSocket = getWebSocket();

  

  const createGame = async () => {
    if (!playerName.trim()) return
    webSocket.emit("create",playerName);

    const roomID = await new Promise<string>((resolve) => {
        webSocket.once("sendRoom", (room:string) => resolve(room));
    });

    router.push(`/lobby/${roomID}?name=${encodeURIComponent(playerName)}&host=true`)
  }

  const joinGame = () => {
    if (!playerName.trim() || !gameId.trim()) return

    webSocket.emit("join",{"gameID":gameId,"playerName":playerName},(response)=>{
        if (!response.success) {
          alert(response.message); // or show error in UI
          return;
      }
    });

    router.push(`/lobby/${gameId}?name=${encodeURIComponent(playerName)}`)
  }

  const spectateGame = () => {
    if (!gameId.trim()) return

    webSocket.emit("spectate",{"gameID":gameId},(response)=>{
        if (!response.success) {
          alert(response.message); // or show error in UI
          return;
      }
    });

    
    router.push(`/spectate/${gameId}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-md mx-auto pt-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Zap className="w-12 h-12 text-yellow-400 mr-2" />
            <h1 className="text-4xl font-bold text-white">LaserTag</h1>
          </div>
          <p className="text-gray-300">Mobile AR Laser Tag Experience</p>
        </div>

        <Card className="mb-6 bg-black/20 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Player Setup</CardTitle>
            <CardDescription className="text-gray-300">Enter your name to start playing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Button
            onClick={createGame}
            disabled={!playerName.trim()}
            className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-semibold"
          >
            <Users className="w-5 h-5 mr-2" />
            Create New Game
          </Button>

          <Card className="bg-black/20 border-gray-700">
            <CardContent className="pt-6 space-y-4">
              <Input
                placeholder="Enter Game ID"
                value={gameId}
                onChange={(e) => setGameId(e.target.value.toUpperCase())}
                className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={joinGame}
                  disabled={!playerName.trim() || !gameId.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Join Game
                </Button>
                <Button
                  onClick={spectateGame}
                  disabled={!gameId.trim()}
                  variant="outline"
                  className="border-gray-600 text-white hover:bg-gray-800 bg-transparent"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Spectate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>Use your camera to scan colored targets</p>
          <p>Red = Shoot • Blue = Shield • Green = Health</p>
        </div>
      </div>
    </div>
  )
}
