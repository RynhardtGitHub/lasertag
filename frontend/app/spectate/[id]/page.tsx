"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useGameStore } from "@/lib/store"
import { Eye, Heart, Zap, Clock, Users } from "lucide-react"
import { getWebSocket } from "@/lib/websocket"

export default function SpectatePage() {
  const params = useParams()
  const gameId = params.id as string
  const router = useRouter();
  const webSocket = getWebSocket();

  const { players, gameTime, setPlayers, setGameId, setGameTime } = useGameStore();

  useEffect(() => {
    setGameId(gameId)
  }, [gameId, setGameId])

  // Game timer setup
  const [timerId, setTimerId] = useState<number | null>(null)

  // Fetch data every two seconds
  useEffect(() => {
    // guard: don’t start polling until we know our gameId
    if (!gameId) return

    const interval = setInterval(() => {
      webSocket.emit(
        'getRoomInfo',
        gameId,
        (res: { success?: boolean; activePlayers?: any[]; error?: string }) => {
          if (res.error) {
            console.error('Failed to fetch room info:', res.error)
            return
          }
          if (res.success && Array.isArray(res.activePlayers)) {
            // shove the live list of players into your store
            setPlayers(res.activePlayers)
          }
        }
      )
    }, 2_000)

    return () => clearInterval(interval)
  }, [gameId, webSocket, setPlayers])

  webSocket.on('readyUp', () => {
    let gt = gameTime;
    // initialize the time
    setGameTime(Math.max(0, gameTime))
  
    // clear any existing timer (safety)
    if (timerId) clearInterval(timerId)
  
    // start a brand-new timer
    const id = window.setInterval(() => {
      setGameTime(gt = Math.max(0, gt - 1))
    }, 1000)
    setTimerId(id)
  })
  
  useEffect(() => {
    if (gameTime === 0) {
      router.push(`/results/${gameId}`)
    }
  }, [gameTime, gameId, router])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const alivePlayers = players.filter((p) => p.isAlive)
  const deadPlayers = players.filter((p) => !p.isAlive)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-md mx-auto pt-4">
        <Card className="mb-6 bg-black/20 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <div className="flex items-center">
                <Eye className="w-5 h-5 mr-2" />
                Spectating
              </div>
              <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                {gameId}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{formatTime(gameTime)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{alivePlayers.length} alive</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card className="mb-6 bg-black/20 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...players]
                .sort((a, b) => b.score - a.score)
                .map((player, index) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      player.isAlive ? "bg-gray-800/50" : "bg-red-900/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-white font-bold text-lg w-6">#{index + 1}</div>
                      <div>
                        <div className="text-white font-medium">{player.name}</div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="flex items-center gap-1">
                            <Heart className="w-3 h-3 text-red-500" />
                            <span className={player.isAlive ? "text-green-400" : "text-red-400"}>{player.health}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-yellow-500" />
                            <span className="text-yellow-400">{player.score}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Badge variant={player.isAlive ? "default" : "destructive"} className="text-xs">
                      {player.isAlive ? "Alive" : "Eliminated"}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Game Stats */}
        <Card className="bg-black/20 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Game Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-gray-800/50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-green-400">{alivePlayers.length}</div>
                <div className="text-gray-300 text-sm">Players Alive</div>
              </div>
              <div className="bg-gray-800/50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-red-400">{deadPlayers.length}</div>
                <div className="text-gray-300 text-sm">Eliminated</div>
              </div>
              <div className="bg-gray-800/50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-yellow-400">{Math.max(...players.map((p) => p.score), 0)}</div>
                <div className="text-gray-300 text-sm">High Score</div>
              </div>
              <div className="bg-gray-800/50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-blue-400">{formatTime(300 - gameTime)}</div>
                <div className="text-gray-300 text-sm">Elapsed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-gray-400 text-sm">
          <p>Real-time spectator view</p>
          <p>Updates automatically as players compete</p>
        </div>
      </div>
    </div>
  )
}
