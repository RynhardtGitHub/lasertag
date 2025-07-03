"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useGameStore } from "@/lib/store"
import { getWebSocket } from "@/lib/websocket"
import { Users, Crown, Play, Copy, Check } from "lucide-react"

//LobbyPage component for the game lobby
export default function LobbyPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const gameId = params.id as string
  const playerName = searchParams.get("name") || "Anonymous"
  const websocket = getWebSocket();

  const [shootId, setShootId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [copied, setCopied] = useState(false)
  const { players, currentPlayer, gameStatus, setGameId, addPlayer, setCurrentPlayer, setGameStatus } = useGameStore()


  useEffect(() => {
    websocket.emit("getRoomInfo",gameId);

    const handleUpdateRoom = (playersFromServer : typeof players)=>{
      useGameStore.getState().setPlayers(playersFromServer);

      for (const player of playersFromServer) {
        if (player.id === websocket.getId()) {
          if (player.isHost!= undefined) {
            console.log("Player is host:", player.isHost);
            setIsHost(player.isHost);
            setCurrentPlayer(player);
            setGameId(gameId);
            setShootId(player.shootId);
          }
        }
      }
    }

    const readyUp = (gameId: string) => {
      console.log("Ready up received for game:", gameId);
      setTimeout(() => {
        router.push(`/game/${gameId}`)
      }, 3000)
    }

    websocket.on("readyUp", readyUp);
    websocket.on("updateRoom", handleUpdateRoom);

     return () => {
        websocket.off("updateRoom", handleUpdateRoom);
        websocket.off("readyUp", readyUp);
      };
  }, [gameId, playerName])


  const copyGameId = async () => {
    try {
      await navigator.clipboard.writeText(gameId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy game ID")
    }
  }

  
  const startGame = () => {
    if (isHost && players.length >= 1){
        websocket.emit("startGame", gameId);
      }
  }


  const canStart = isHost && players.length >= 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-md mx-auto pt-4">
        <Card className="mb-6 bg-black/20 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span>Game Lobby</span>
              <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                {gameId}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={copyGameId}
                className="flex-1 border-gray-600 text-white hover:bg-gray-800 bg-transparent"
              >
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? "Copied!" : "Share Game ID"}
              </Button>
            </div>

            <div className="text-center text-gray-300">
              <p className="text-sm">
                {gameStatus === "waiting"
                  ? `Waiting for players (${players.length}/8)`
                  : gameStatus === "starting"
                    ? "Game starting..."
                    : "Game in progress"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 bg-black/20 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Players ({players.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {players.map((player) => (
                <div key={player.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-2 w-full">
                    {player.isHost && <Crown className="min-w-4 min-h-4 text-yellow-400" />}
                    <span className="text-white font-medium">{player.name}</span>
                    {player.id === currentPlayer?.id && (
                      <Badge variant="secondary" className="text-xs">
                        You
                      </Badge>
                    )}
                    <span className="text-white font-bold w-full text-center">Shirt colour: {(player.shootId)}</span>
                  </div>
                  <Badge variant="outline" className="text-green-400 border-green-400">
                    Ready
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {gameStatus === "starting" && (
          <Card className="mb-6 bg-green-900/20 border-green-700">
            <CardContent className="pt-6 text-center">
              <div className="text-green-400 font-semibold mb-2">Game Starting!</div>
              <div className="text-gray-300 text-sm">Get ready to scan targets...</div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {canStart && (
            <Button
              onClick={startGame}
              className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Game
            </Button>
          )}

          {!canStart && !isHost && (
            <div className="text-center text-gray-400 text-sm">Waiting for host to start the game...</div>
          )}

          {!canStart && isHost && players.length < 2 && (
            <div className="text-center text-gray-400 text-sm">Need at least 2 players to start</div>
          )}
        </div>

        <div className="mt-8 text-center text-gray-400 text-xs">
          <p>Game Rules:</p>
          <p>• Scan RED targets to shoot</p>
          <p>• Scan BLUE targets for shield</p>
          <p>• Scan GREEN targets for health</p>
        </div>
      </div>
    </div>
  )
}
