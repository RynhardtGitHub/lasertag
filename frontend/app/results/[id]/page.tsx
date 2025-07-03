"use client"

import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useGameStore } from "@/lib/store"
import { Trophy, Medal, Zap, Heart, Home, RotateCcw } from "lucide-react"
import { getWebSocket } from "@/lib/websocket"

// This page displays the results of a game, including the winner, final leaderboard, 
// and game stats summary.
export default function ResultsPage() {
  const params = useParams()
  const router = useRouter()
  const gameId = params.id as string
  const webSocket = getWebSocket();
  const { players, setPlayers, resetGame } = useGameStore()
  
  webSocket.emit(
    'getRoomInfo',
    gameId,
    (res: { success?: boolean; activePlayers?: any[]; error?: string }) => {
      if (res.error) {
        console.error('Failed to fetch room info:', res.error)
        return
      }
      if (res.success && Array.isArray(res.activePlayers)) {
        setPlayers(res.activePlayers)
      }
    }
  )


  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)
  const winner = sortedPlayers[0]


  const playAgain = () => {
    resetGame()
    router.push("/")
  }


  const goHome = () => {
    resetGame()
    router.push("/")
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-md mx-auto pt-4">
        {/* Winner Card */}
        {winner && (
          <Card className="mb-6 bg-gradient-to-r from-yellow-900/50 to-orange-900/50 border-yellow-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-center">
                <Trophy className="w-6 h-6 mr-2 text-yellow-400" />
                Winner!
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-2xl font-bold text-yellow-400 mb-2">{winner.name}</div>
              <div className="flex justify-center items-center gap-4 text-white">
                <div className="flex items-center gap-1">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span>{winner.score} points</span>
                </div>
                <div className="flex items-center gap-1">
                  <Heart className="w-4 h-4 text-red-500" />
                  <span>{winner.health} HP</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Final Leaderboard */}
        <Card className="mb-6 bg-black/20 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Final Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedPlayers.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    index === 0
                      ? "bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-600/50"
                      : index === 1
                        ? "bg-gradient-to-r from-gray-700/30 to-gray-600/30 border border-gray-500/50"
                        : index === 2
                          ? "bg-gradient-to-r from-orange-900/30 to-red-900/30 border border-orange-600/50"
                          : "bg-gray-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-700">
                      {index === 0 && <Trophy className="w-4 h-4 text-yellow-400" />}
                      {index === 1 && <Medal className="w-4 h-4 text-gray-400" />}
                      {index === 2 && <Medal className="w-4 h-4 text-orange-400" />}
                      {index > 2 && <span className="text-white text-sm font-bold">#{index + 1}</span>}
                    </div>
                    <div>
                      <div className="text-white font-medium">{player.name}</div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-yellow-500" />
                          <span className="text-yellow-400">{player.score}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-red-500" />
                          <span className={player.isAlive ? "text-green-400" : "text-red-400"}>{player.health}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Badge variant={player.isAlive ? "default" : "destructive"} className="text-xs">
                    {player.isAlive ? "Survived" : "Eliminated"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Game Stats Summary */}
        <Card className="mb-6 bg-black/20 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Game Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-gray-800/50 p-3 rounded-lg">
                <div className="text-xl font-bold text-blue-400">{players.length}</div>
                <div className="text-gray-300 text-xs">Total Players</div>
              </div>
              <div className="bg-gray-800/50 p-3 rounded-lg">
                <div className="text-xl font-bold text-green-400">{players.filter((p) => p.isAlive).length}</div>
                <div className="text-gray-300 text-xs">Survivors</div>
              </div>
              <div className="bg-gray-800/50 p-3 rounded-lg">
                <div className="text-xl font-bold text-yellow-400">{Math.max(...players.map((p) => p.score), 0)}</div>
                <div className="text-gray-300 text-xs">High Score</div>
              </div>
              <div className="bg-gray-800/50 p-3 rounded-lg">
                <div className="text-xl font-bold text-purple-400">{gameId}</div>
                <div className="text-gray-300 text-xs">Game ID</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button onClick={playAgain} className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold">
            <RotateCcw className="w-5 h-5 mr-2" />
            Play Again
          </Button>

          <Button
            onClick={goHome}
            variant="outline"
            className="w-full h-12 border-gray-600 text-white hover:bg-gray-800 bg-transparent"
          >
            <Home className="w-5 h-5 mr-2" />
            Back to Home
          </Button>
        </div>

        <div className="mt-6 text-center text-gray-400 text-sm">
          <p>Thanks for playing LaserTag!</p>
          <p>Share your results with friends</p>
        </div>
      </div>
    </div>
  )
}
