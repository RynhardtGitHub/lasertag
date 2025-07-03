"use client"


import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

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
  const [socket, setSocket] = useState<ReturnType<typeof getWebSocket> | null>(null)
  const [playerStreams, setPlayerStreams] = useState<Record<string, MediaStream>>({})
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({})
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  const processingOffers = useRef<Set<string>>(new Set())
  const streamAssigned = useRef<Set<string>>(new Set());
  const [timerId, setTimerId] = useState<number | null>(null)


  useEffect(() => {
    if (!gameId) return;

    const ws = getWebSocket();
    setSocket(ws);

    console.log("Spectator connecting to game:", gameId);

    ws.emit("spectate", { gameID: gameId }, (res) => {
      if (!res.success) {
        console.error("Failed to join as spectator:", res.message);
        return;
      }

      console.log("Joined as spectator");
      ws.emit("spectatorJoin", { gameId });
    });

    const peerConnectionsRef = peerConnections.current;

    const handleOfferFromPlayer = async ({ offer, from: playerId }: { offer: RTCSessionDescriptionInit; from: string }) => {
      console.log("📨 Offer received from:", playerId, "Offer type:", offer.type)

      if (processingOffers.current.has(playerId)) {
        console.log("⏳ Already processing offer for", playerId)
        return
      }
      processingOffers.current.add(playerId)

      try {
        let pc = peerConnectionsRef[playerId] || createPeerConnection(playerId)

        console.log("🔄 Peer connection state:", pc.signalingState)

        if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") {
          console.log("🔄 Resetting peer connection due to state:", pc.signalingState)
          pc.close()
          delete peerConnectionsRef[playerId]
          pc = createPeerConnection(playerId)
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        console.log("✅ Remote description set for", playerId)

        if (pc.signalingState === "have-remote-offer") {
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          console.log("📤 Sending answer to", playerId)

          ws.emit("webrtcAnswer", {
            to: playerId,
            sdp: answer,
          })
        } else {
          console.log("⚠️ Unexpected signaling state after setting remote description:", pc.signalingState)
        }
      } catch (err) {
        console.error("❌ Error handling offer from", playerId, err)
      } finally {
        processingOffers.current.delete(playerId)
      }
    }

    // Enhanced createPeerConnection with better logging
    const createPeerConnection = (playerId: string) => {
      if (peerConnectionsRef[playerId]) {
        console.log("🔄 Closing existing peer connection for", playerId)
        peerConnectionsRef[playerId].close()
        delete peerConnectionsRef[playerId]
      }

      console.log("🆕 Creating new peer connection for", playerId)
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      })

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("🧊 Sending ICE candidate to", playerId)
          ws.emit("webrtcCandidate", {
            to: playerId,
            candidate: event.candidate,
          })
        } else {
          console.log("🧊 ICE gathering complete for", playerId)
        }
      }

      pc.ontrack = (event) => {
        console.log(`📡 Received track from ${playerId}:`, {
          kind: event.track.kind,
          enabled: event.track.enabled,
          readyState: event.track.readyState,
          streamsCount: event.streams?.length || 0
        })

        const stream = event.streams?.[0]
        if (!stream) {
          console.warn(`⚠️ No stream received from ${playerId}`)
          return
        }

        const videoTracks = stream.getVideoTracks()
        const audioTracks = stream.getAudioTracks()
        
        console.log(`📹 Stream details for ${playerId}:`, {
          videoTracks: videoTracks.length,
          audioTracks: audioTracks.length,
          videoEnabled: videoTracks.map(t => t.enabled),
          videoReadyState: videoTracks.map(t => t.readyState),
          streamId: stream.id
        })

        if (videoTracks.length === 0) {
          console.warn(`⚠️ No video tracks in stream from ${playerId}`)
          return
        }

        // Set stream immediately
       setPlayerStreams((prev) => {
        if (prev[playerId] === stream) {
          return prev; // Don't update if it's the same stream
        }
        console.log(`🎬 Adding stream for ${playerId}`)
        return {
          ...prev,
          [playerId]: stream,
        }
      })

        // Also try to set video element directly if it exists
        const videoEl = videoRefs.current[playerId]
        if (videoEl) {
          console.log(`🎥 Setting srcObject directly for ${playerId}`)
          videoEl.srcObject = stream
          videoEl.play().catch(err => console.error('Direct play failed:', err))
        }
      }

      pc.onconnectionstatechange = () => {
        console.log(`🔌 Connection state (${playerId}):`, pc.connectionState)
        if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          console.log(`🔌 Removing stream for disconnected player ${playerId}`)
          setPlayerStreams((prev) => {
            const newStreams = { ...prev }
            delete newStreams[playerId]
            streamAssigned.current.delete(playerId)
            return newStreams
          })
        }
      }

      pc.oniceconnectionstatechange = () => {
        console.log(`🧊 ICE connection state (${playerId}):`, pc.iceConnectionState)
      }

      peerConnectionsRef[playerId] = pc
      return pc
    }

    const handleWebRTCCandidate = async ({ candidate, from: playerId }: { candidate: RTCIceCandidateInit; from: string }) => {
      const pc = peerConnectionsRef[playerId]
      if (pc?.remoteDescription && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (err) {
          console.error("Failed to add ICE candidate from", playerId, err)
        }
      }
      else{
        console.log("no Candidate")
      }
    }

    const handlePlayerDisconnected = ({ playerId }: { playerId: string }) => {
      const pc = peerConnectionsRef[playerId]
      if (pc) pc.close()
      delete peerConnectionsRef[playerId]
      setPlayerStreams((prev) => {
        const copy = { ...prev }
        delete copy[playerId]
        return copy
      })
    }

    ws.on("offerFromPlayer", handleOfferFromPlayer)
    ws.on("webrtcCandidate", handleWebRTCCandidate)
    ws.on("playerDisconnected", handlePlayerDisconnected)

    return () => {
      Object.values(peerConnectionsRef).forEach((pc) => pc?.close())
      Object.keys(peerConnectionsRef).forEach((k) => delete peerConnectionsRef[k])
      processingOffers.current.clear()
      setPlayerStreams({})
      ws.off("offerFromPlayer", handleOfferFromPlayer)
      ws.off("webrtcCandidate", handleWebRTCCandidate)
      ws.off("playerDisconnected", handlePlayerDisconnected)
    }
  }, [gameId])

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
  
  webSocket.on('updateTimer', (timerVal) => {
    setGameTime(timerVal);
  });
  
  webSocket.on('endSession', () => router.push(`/results/${gameId}`));

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const alivePlayers = players.filter((p) => p.isAlive)
  const deadPlayers = players.filter((p) => !p.isAlive)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w mx-auto pt-4">
        {/* Header */}
        <Card className="mb-6 bg-black/20 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex justify-between items-center">
              <div className="flex items-center">
                <Eye className="w-5 h-5 mr-2" />
                Spectating
              </div>
              <Badge variant="outline" className="text-yellow-400 border-yellow-400">{gameId}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between text-white">
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
          <CardHeader><CardTitle className="text-white">Leaderboard</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...players].sort((a, b) => b.score - a.score).map((player, index) => (
                <div key={player.id} className={`flex justify-between p-3 rounded-lg ${player.isAlive ? "bg-gray-800/50" : "bg-red-900/30"}`}>
                  <div className="flex gap-3">
                    <div className="text-white font-bold text-lg w-6">#{index + 1}</div>
                    <div>
                      <div className="text-white font-medium">{player.name}</div>
                      <div className="flex gap-2 text-sm">
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
          <CardHeader><CardTitle className="text-white">Game Stats</CardTitle></CardHeader>
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
            </div>
          </CardContent>
        </Card>

        {Object.keys(playerStreams).length > 0 && (
          <Card className="mt-6 bg-black/20 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Player Streams</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(playerStreams).map(([playerId, stream]) => {
                  const player = players.find(p => p.id === playerId);
                  return (
                    <div key={playerId} className="relative">
                      <video 
                        ref={el => {
                          videoRefs.current[playerId] = el
                          if (el && stream && !streamAssigned.current.has(playerId)) {
                            el.srcObject = stream
                            streamAssigned.current.add(playerId)
                            el.muted = true
                            el.playsInline = true
                            el.autoplay = true
                            
                            // Add these important attributes and error handling
                            el.controls = false
                            el.style.backgroundColor = '#1f2937' // gray-800 for debugging
                            
                            // Force play with better error handling
                            // const playPromise = el.play()
                            // if (playPromise !== undefined) {
                            //   playPromise
                            //     .then(() => {
                            //       console.log(`✅ Video playing for ${playerId}`)
                            //     })
                            //     .catch(err => {
                            //       console.error(`❌ Video play failed for ${playerId}:`, err)
                            //       // Try to play again after a short delay
                            //       setTimeout(() => {
                            //         el.play().catch(e => console.error('Retry play failed:', e))
                            //       }, 1000)
                            //     })
                            // }
                          }
                        }}
                        className="w-full aspect-video rounded-md bg-gray-900 border-2 border-gray-600"

                        onError={(e) => console.error(`🚫 Video error for ${playerId}:`, e)}
                      />
                      {player && (
                        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                          {player.name}
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        {stream.getVideoTracks().length > 0 ? '📹' : '❌'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug */}
        <div className="mt-6 text-center text-gray-400 text-sm">
          <p>Real-time spectator view</p>
          <p>Updates automatically as players compete</p>
          {Object.keys(playerStreams).length === 0 && (
            <p className="text-yellow-400 mt-2">Waiting for player streams...</p>
          )}
        </div>
      </div>
    </div>
  )
}
