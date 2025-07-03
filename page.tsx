  "use client"

  import { useEffect, useRef, useState } from "react"
  import { useParams, useRouter } from "next/navigation"
  import { Button } from "@/components/ui/button"
  import { Card, CardContent } from "@/components/ui/card"
  import { Badge } from "@/components/ui/badge"
  import { useGameStore } from "@/lib/store"
  import { Zap, Heart, Users, Clock } from "lucide-react"
  import Tesseract from "tesseract.js";
  import { getWebSocket } from "@/lib/websocket"
  //import {laser_Sound} from "@/public/sound/laser_Sound.mp3"

  export default function GamePage() {
    const websocket = getWebSocket();
    const params = useParams()
    const router = useRouter()
    const gameId = params.id as string
    const webSocket = getWebSocket();   

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [cameraActive, setCameraActive] = useState(false)
    const [detectedColor, setDetectedColor] = useState<string | null>(null)
    const [lastAction, setLastAction] = useState<string>("")

    //const { players, currentPlayer, gameTime, setGameTime, shootPlayer, healPlayer, shieldPlayer } = useGameStore();

    const players = useGameStore((state) => state.players);
    const currentPlayer = useGameStore((state) => state.currentPlayer);
    const setPlayers = useGameStore((state) => state.setPlayers);
    const setGameTime = useGameStore((state) => state.setGameTime);
    const shootPlayer = useGameStore((state) => state.shootPlayer);
    const healPlayer = useGameStore((state) => state.healPlayer);
    const shieldPlayer = useGameStore((state) => state.shieldPlayer);
    const gameTime = useGameStore((state) => state.gameTime);

    function sleep(ms: number | undefined) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    /*
    detectColor is also performing OCR
    */
    async function scanUser() {
      await detectColor();
    }
    
    // Game timer
    /*useEffect(() => {
      const timer = setInterval(() => {
        setGameTime(Math.max(0, gameTime - 1))
      }, 1000)

      if (gameTime === 0) {
        router.push(`/results/${gameId}`)
      }

      return () => clearInterval(timer)
    }, [gameTime, gameId, router, setGameTime])*/

    // 1-second countdown timer
useEffect(() => {
  const timer = setInterval(() => {
    setGameTime(Math.max(0, gameTime - 1));
  }, 1000);

  if (gameTime === 0) {
    router.push(`/results/${gameId}`);
  }

  return () => clearInterval(timer);
}, [gameTime, gameId, router, setGameTime]);

// 30-second heal timer, starts only after 30 seconds (no immediate run)
useEffect(() => {
  const interval = setInterval(() => {
    if (currentPlayer) {
      healPlayer(currentPlayer.id);
      console.log("30s");
      webSocket.emit("misc", currentPlayer.id);

      websocket.on("updateRoom", (updatedPlayers) => {
          useGameStore.getState().setPlayers(updatedPlayers);
          console.log("Updated players:", updatedPlayers)
          });
      //setLastAction("You gained passive regen!");
    }
  }, 30000);

  return () => clearInterval(interval);
}, [currentPlayer, healPlayer]);


    // Camera setup
    useEffect(() => {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          })

          if (videoRef.current) {
            videoRef.current.srcObject = stream
            setCameraActive(true)
          }
        } catch (err) {
          console.error("Error accessing camera:", err)
        }
      }

      startCamera();

      if (cameraActive && videoRef.current && canvasRef.current) {
        console.log("Camera, videoRef, and canvasRef are ready. Attaching click listener.")
        window.addEventListener('mousedown', scanUser);
      } else {
        console.log("Waiting for camera, videoRef, or canvasRef to be ready. Current state: ", {
          cameraActive,
          videoRefCurrent: videoRef.current,
          canvasRefCurrent: canvasRef.current
        });
      }

      return () => {
        if (videoRef.current?.srcObject) {
          const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
          tracks.forEach((track) => track.stop())
        }
        
        // Always remove the event listener on cleanup to prevent memory leaks
        window.removeEventListener('mousedown', scanUser);
        console.log("Cleaning up camera and click listener.");
      }
    }, [cameraActive, videoRef, canvasRef])
//typeof players
    useEffect(() => {
    const handleUpdateRoom = (playersFromServer: typeof players) => {
    setPlayers(playersFromServer);

    // Also re-sync currentPlayer
    const current = useGameStore.getState().currentPlayer;
    if (current) {
      const updatedCurrent = playersFromServer.find(p => p.shootId === current.shootId);
      if (updatedCurrent) {
        useGameStore.getState().setCurrentPlayer(updatedCurrent);
      }
    }
  };

  websocket.on("updateRoom", handleUpdateRoom);

  return () => {
    websocket.off("updateRoom", handleUpdateRoom);
  };
}, [setPlayers]);


    async function detectColor() {
      if (!cameraActive || !videoRef.current || !canvasRef.current) return

      console.log('Clicked')

      const video = videoRef.current!
      const canvas = canvasRef.current!
      const ctx = canvas.getContext("2d")!

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      ctx.drawImage(video, 0, 0)

      // Sample center area of the image
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      const sampleSize = 150

      const imageData = ctx.getImageData(
        centerX - sampleSize / 2,
        centerY - sampleSize / 2,
        sampleSize,
        sampleSize
      )

      const ocrCanvas = document.createElement("canvas")
      ocrCanvas.width = sampleSize
      ocrCanvas.height = sampleSize
      ocrCanvas.getContext("2d")!.putImageData(imageData, 0, 0)

      let r = 0,
        g = 0,
        b = 0
      const pixels = imageData.data.length / 4

      for (let i = 0; i < imageData.data.length; i += 4) {
        r += imageData.data[i]
        g += imageData.data[i + 1]
        b += imageData.data[i + 2]
      }

      r = Math.floor(r / pixels)
      g = Math.floor(g / pixels)
      b = Math.floor(b / pixels)

      // Detect dominant color
      const threshold = 50
      if (r > g + threshold && r > b + threshold) {
        setDetectedColor("red")
        handleColorAction("red")
      } else if (g > r + threshold && g > b + threshold) {
        setDetectedColor("green")
        handleColorAction("green")
      } else if (b > r + threshold && b > g + threshold) {
        setDetectedColor("blue")
        handleColorAction("blue")
      } else {
        setDetectedColor(null)
      }

      // OCR: Detect numbers
      try {
        console.log('OCR:')
        const {
          data: { text },
        } = await Tesseract.recognize(ocrCanvas, "eng", {params: { tessedit_char_whitelist: "ABPURM0123456789" },})

        console.log(`Tesseract text: ${text}`)
        const detectedNumber = text.trim()
        if (detectedNumber) {
          
          const matchedDigits = detectedNumber.match(/[ABPURM0-9]+/gi) // returns array of digit sequences

          if (matchedDigits && matchedDigits.length > 0) {
            const number = matchedDigits[0] // pick first sequence
            console.log("Detected number:", number)

            // Optional: only accept 1–4 digit numbers
            if (number.length >= 1 && number.length <= 2) {
              handleNumberAction(number)
            }
          } else {
            console.log("No valid number detected.")
          }
        }
      } catch (error) {
        console.error("OCR error:", error)
      }
    }

    const handleNumberAction = async (detectedNumber: string) => {
      if (!currentPlayer) return

      const now = Date.now()
      const lastActionTime = Number.parseInt(localStorage.getItem("lastActionTime") || "0")

      // Prevent spam (1 second cooldown)
      if (now - lastActionTime < 1000) return

      localStorage.setItem("lastActionTime", now.toString())

      setLastAction(`${detectedNumber}`)
      try {
        const response = await new Promise<{ success?: boolean, activePlayers?: any[], error?: string }>((resolve, reject) => {
          websocket.emit("getRoomInfo", gameId, (res) => {
            if (res?.error) return reject(res.error);
            resolve(res);
          });
        });

        console.log("Room data:", response.activePlayers);

        const roomPlayers = response.activePlayers || [];

        // Look for a player with matching shootId
        const matchedPlayer = roomPlayers.find(
          (player) => player.shootId.toLowerCase() === detectedNumber.toLowerCase()
        );

        if (matchedPlayer) {
          //Checking for debugging purposes
          //console.log("Target acquired:", matchedPlayer.name);
          //console.log(matchedPlayer.shootId);
          //console.log(currentPlayer.shootId);

          websocket.emit("triggerEvent", {
            gameID: `${gameId}`,
            eventType: 0,
            eventData: {
              shooterId: currentPlayer.shootId,
              targetId: matchedPlayer.shootId
            }},
            
          );
          
          setLastAction(`Shot ${matchedPlayer.name}!`);

          // <- This updates your local UI/state
          websocket.on("updateRoom", (updatedPlayers) => {
          useGameStore.getState().setPlayers(updatedPlayers);
          console.log("Updated players:", updatedPlayers)
          });
         
        } else {
          // console.log("No matching shoot ID found for", detectedNumber);
          setLastAction("Missed! No player found.");
        }
      } catch (err) {
        console.error("Failed to get room info:", err);
      }
      // websocket.emit('shootPlayer', detectedNumber);

      setTimeout(() => setLastAction(""), 2000)
    }

    /*function PlayLaser(){
      new Audio(laser_Sound).play()
    }*/
    const handleColorAction = (color: string) => {
      if (!currentPlayer) return

      const now = Date.now()
      const lastActionTime = Number.parseInt(localStorage.getItem("lastActionTime") || "0")

      // Prevent spam (1 second cooldown)
      if (now - lastActionTime < 1000) return

      localStorage.setItem("lastActionTime", now.toString())

      switch (color) {
        case "red":
          // Shoot random player
          const alivePlayers = players.filter((p) => p.isAlive && p.id !== currentPlayer.id)
          if (alivePlayers.length > 0) {
            const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)]
            shootPlayer(currentPlayer.id, target.id)
            setLastAction(`Shot ${target.name}!`)
          }
          break
        case "green":
          healPlayer(currentPlayer.id)
          setLastAction("Health restored!")
          break
        case "blue":
          shieldPlayer(currentPlayer.id)
          setLastAction("Shield activated!")
          break
      }

      setTimeout(() => setLastAction(""), 2000)
    }

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${mins}:${secs.toString().padStart(2, "0")}`
    }

    const getColorIndicator = () => {
      switch (detectedColor) {
        case "red":
          return <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
        case "green":
          return <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse" />
        case "blue":
          return <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" />
        default:
          return <div className="w-4 h-4 bg-gray-500 rounded-full" />
      }
    }

    if (!currentPlayer) {
      return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>
    }

    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        {/* Camera View */}
        <div className="absolute inset-0">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />

          {/* Crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/*<div className="w-8 h-8 border-2 border-white rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>*/}
            <div
            className="border-2 border-white flex items-center justify-center"
            style={{
              width: '150px',
              height: '150px',
              borderRadius: '0',
            }}
          ></div>
          </div>
        </div>

        {/* HUD Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Top HUD */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
            <Card className="bg-black/70 border-gray-600 pointer-events-auto">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-white text-sm">
                  <Clock className="w-4 h-4" />
                  {formatTime(gameTime)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/70 border-gray-600 pointer-events-auto">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-white text-sm">
                  <Users className="w-4 h-4" />
                  {players.filter((p) => p.isAlive).length} alive
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Player Stats */}
          <div className="absolute top-20 left-4 right-4">
            <Card className="bg-black/70 border-gray-600">
              <CardContent className="p-3">
                <div className="flex justify-between items-center text-white text-sm">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-red-500" />
                    <div className="w-20 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full transition-all"
                        style={{ width: `${currentPlayer.health}%` }}
                      />
                    </div>
                    <span>{currentPlayer.health}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span>{currentPlayer.score}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Color Detection Indicator */}
          <div className="absolute top-36 left-4">
            <Card className="bg-black/70 border-gray-600">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-white text-sm">
                  <span>Target:</span>
                  {getColorIndicator()}
                  <span className="capitalize">{detectedColor || "None"}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Feedback */}
          {lastAction && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <Card className="bg-green-900/90 border-green-600">
                <CardContent className="p-4">
                  <div className="text-green-400 font-bold text-center">{lastAction}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Weapon Info */}
          <div className="absolute bottom-20 left-4 right-4">
            <Card className="bg-black/70 border-gray-600">
              <CardContent className="p-3">
                <div className="flex items-center justify-between text-white text-sm">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    <span>{currentPlayer.weapon}</span>
                    <audio id="shootAudio" preload="auto">
                    <source src="/sounds/shoot.mp3" type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                  </div>
                  <div className="flex gap-1">
                    <Badge variant="outline" className="text-red-400 border-red-400 text-xs">
                      RED: Shoot
                    </Badge>
                    <Badge variant="outline" className="text-blue-400 border-blue-400 text-xs">
                      BLUE: Shield
                    </Badge>
                    <Badge variant="outline" className="text-green-400 border-green-400 text-xs">
                      GREEN: Heal
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Exit Button */}
          <div className="absolute bottom-4 left-4 right-4 pointer-events-auto">
            <Button onClick={() => router.push(`/results/${gameId}`)} variant="destructive" className="w-full">
              End Game
            </Button>
          </div>
        </div>
      </div>
    )
  }
