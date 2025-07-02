  "use client"

  import { useEffect, useRef, useState } from "react"
  import { useParams, useRouter } from "next/navigation"
  import { Button } from "@/components/ui/button"
  import { Card, CardContent } from "@/components/ui/card"
  import { Badge } from "@/components/ui/badge"
  import { useGameStore } from "@/lib/store"
  import "@tensorflow/tfjs-backend-webgl"; // Ensure WebGL backend is used for TensorFlow.js
  import { Zap, Heart, Users, Clock, Coins } from "lucide-react"
  import Tesseract from "tesseract.js";
  import { getWebSocket } from "@/lib/websocket"
  import * as tf from "@tensorflow/tfjs";
  import { detectImage } from "./utils/detect";

  export default function GamePage() {
    const params = useParams()
    const router = useRouter()
    const gameId = params.id as string
    const webSocket = getWebSocket();  

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [cameraActive, setCameraActive] = useState(false)
    const [roomPlayers, setRoomPlayers] = useState<typeof players>([]);

    const [detectedColor, setDetectedColor] = useState<string | null>(null)
    const [lastAction, setLastAction] = useState<string>("")

    const { players, currentPlayer, gameTime, setGameTime, shootPlayer, healPlayer, shieldPlayer } = useGameStore();
    
    //YOLO START
    const [loading, setLoading] = useState({ loading: true, progress: 0 }); // loading state
    
    const [net,setNet]= useState<tf.GraphModel | null>(null); // YOLO model state
    const [inputShape,setInputShape] = useState<any>(null) // YOLO model state
    const [modelReady, setModelReady] = useState(false);

    // references
    const imageRef = useRef(null);
    const cameraRef = useRef(null);
    //YOLO END

    // model configs
    const modelName = "yolov5n";
    const classThreshold = 0.5;
    
    function sleep(ms: number | undefined) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    const audioCtx = useRef(new (window.AudioContext || window.webkitAudioContext)());

    const loadAndPlaySound = async (url = "/sounds/pew.mp3") => {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.current.decodeAudioData(arrayBuffer);

        const source = audioCtx.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.current.destination);
        source.start(0);
      } catch (err) {
        console.error("Failed to play sound:", err);
      }
    };

    /*
    detectColor is also performing OCR
    */
    async function scanUser() {
      await loadAndPlaySound(); // Play sound on click

      console.log(net, inputShape, cameraActive, videoRef.current, canvasRef.current)
      if (!cameraActive || !videoRef.current || !canvasRef.current || net == null) return

      // Pass the callback function to handle detected players
      detectImage(
        videoRef.current, 
        net, 
        inputShape, 
        classThreshold, 
        canvasRef.current,
        handlePlayerDetected // New callback function
      );
      
      // You can still call detectColor if you want to keep the color detection
      // await detectColor();
  }
  const handlePlayerDetected = async (playerId:string, detectedColor=null) => {
  console.log("Player ID detected:", playerId);

  if (!currentPlayer) return;

  console.log("Player detected in bounding box:", playerId);
  console.log("Detected color:", detectedColor);

  const now = Date.now();
  const lastActionTime = Number.parseInt(localStorage.getItem("lastActionTime") || "0");

  // Prevent spam (1 second cooldown)
  if (now - lastActionTime < 1000) return;

  localStorage.setItem("lastActionTime", now.toString());

  setLastAction(`Targeting ${playerId}...`);
  
  try {
    const matchedPlayer = roomPlayers.find(
      (player) => player.shootId.toLowerCase() === playerId.toLowerCase()
    );

    console.log("Matched player:", matchedPlayer);
    console.log("Room players:", roomPlayers);

    if (matchedPlayer) {
      console.log("Target acquired:", matchedPlayer.name);

      // Emit the shoot event
      webSocket.emit("triggerEvent", {
        gameID: `${gameId}`,
        eventType: 0,
        eventData: {
          shooterId: currentPlayer.id,
          targetId: matchedPlayer.id,
          shootId: playerId,
        }
      });

      console.log("Shoot event triggered for", matchedPlayer.name);
      setLastAction(`Shot ${matchedPlayer.name}!`);
    } else {
      setLastAction("Missed! No player found.");
    }
  } catch (err) {
    console.error("Failed to process player detection:", err);
  }

  setTimeout(() => setLastAction(""), 2000);
};



    useEffect(() => {
        tf.ready().then(async () => {
          const yolov5 = await tf.loadGraphModel(
            `/${modelName}_web_model/model.json`,
            {
              onProgress: (fractions) => {
                setLoading({ loading: true, progress: fractions }); // set loading fractions
              },
            }
          ); // load model
    
          // warming up model
          // const dummyInput = tf.ones(yolov5.inputs[0].shape);
          // const warmupResult = await yolov5.executeAsync(dummyInput);
          // tf.dispose(warmupResult); // cleanup memory
          // tf.dispose(dummyInput); // cleanup memory
    
          setLoading({ loading: false, progress: 1 });
          setNet(yolov5); // set model to state

          // set input shape
          setInputShape(yolov5.inputs[0].shape); // get input shape
          setModelReady(true); // ✅ model is ready
        });
      }, []);

    
    useEffect(() => {
      console.log("modelYOLO:", inputShape);
      console.log("modelYOLO:", net);
    }, [net, inputShape]);

    useEffect(() => {
      webSocket.emit("getRoomInfo", gameId);

      const handleUpdateRoom = (playersFromServer: typeof players) => {
        useGameStore.getState().setPlayers(playersFromServer);
        setRoomPlayers(playersFromServer);
      };

      webSocket.on("updateRoom", handleUpdateRoom);

      return () => {
        webSocket.off("updateRoom", handleUpdateRoom); // clean up listener
      };
    }, [webSocket, gameId]);
    
    // Game timer
    useEffect(() => {
      const timer = setInterval(() => {
        setGameTime(Math.max(0, gameTime - 1))
      }, 1000)

      if (gameTime === 0) {
        router.push(`/results/${gameId}`)
      }

      return () => clearInterval(timer)
    }, [gameTime, gameId, router, setGameTime])

    // Camera setup
    useEffect(() => {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 }
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

      if (cameraActive && videoRef.current && canvasRef.current && modelReady) {
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
    }, [cameraActive, videoRef, canvasRef,modelReady])

    useEffect(() => {
      const handleUpdateRoom = (playersFromServer : typeof players)=>{
        useGameStore.getState().setPlayers(playersFromServer);
      }

      webSocket.on("updateRoom", handleUpdateRoom);
    },[]);

    // 3. Update your detectColor function to work with the new system:
async function detectColor() {
  if (!cameraActive || !videoRef.current || !canvasRef.current) return

  console.log('Color detection clicked')

  const video = videoRef.current!
  const canvas = canvasRef.current!
  const ctx = canvas.getContext("2d")!

  // Sample center area of the image for color detection
  const centerX = canvas.width / 2
  const centerY = canvas.height / 2
  const sampleSize = 150

  const imageData = ctx.getImageData(
    centerX - sampleSize / 2,
    centerY - sampleSize / 2,
    sampleSize,
    sampleSize
  )

  let r = 0, g = 0, b = 0
  const pixels = imageData.data.length / 4

  for (let i = 0; i < imageData.data.length; i += 4) {
    r += imageData.data[i]
    g += imageData.data[i + 1]
    b += imageData.data[i + 2]
  }

  r = Math.floor(r / pixels)
  g = Math.floor(g / pixels)
  b = Math.floor(b / pixels)

  // Detect dominant color and trigger actions
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
}


    const handleNumberAction = async (detectedNumber: string) => {
      if (!currentPlayer) return

      console.log("Handling number action for:", detectedNumber)

      const now = Date.now()
      const lastActionTime = Number.parseInt(localStorage.getItem("lastActionTime") || "0")

      // Prevent spam (1 second cooldown)
      if (now - lastActionTime < 1000) return

      localStorage.setItem("lastActionTime", now.toString())

      setLastAction(`${detectedNumber}`)
      
      try {
        const matchedPlayer = roomPlayers.find(
          (player) => player.shootId.toLowerCase() === detectedNumber.toLowerCase()
        );

        console.log("Matched player:", matchedPlayer)
        console.log(roomPlayers)

        if (matchedPlayer) {
          console.log("Target acquired:", matchedPlayer.name);

          webSocket.emit("triggerEvent", {
            gameID: `${gameId}`,
            eventType: 0,
            eventData: {
              shooterId: currentPlayer.id,
              targetId: matchedPlayer.id,
              shootId: detectedNumber,
            }}
          );

          console.log("Shoot event triggered for", matchedPlayer.name);

          setLastAction(`Shot ${matchedPlayer.name}!`);
        } else {
          // console.log("No matching shoot ID found for", detectedNumber);
          setLastAction("Missed! No player found.");
        }

        // websocket.emit("shootPlayer", detectedNumber);

      } catch (err) {
        console.error("Failed to get room info:", err);
      }
      // websocket.emit('shootPlayer', detectedNumber);

      setTimeout(() => setLastAction(""), 2000)
    }

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
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"/>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />


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
          <div className={`absolute ${currentPlayer.isHost ? 'bottom-20' : 'bottom-4'} left-4 right-4`}>
            <Card className="bg-black/70 border-gray-600">
              <CardContent className="p-3">
                <div className="flex items-center justify-between text-white text-sm">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    <span>{currentPlayer.weapon}</span>
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
          {currentPlayer.isHost && (
            <div className="absolute bottom-4 left-4 right-4 pointer-events-auto">
              <Button onClick={() => router.push(`/results/${gameId}`)} variant="destructive" className="w-full">
                End Game
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }
