  "use client"

  import { useEffect, useRef, useState } from "react"
  import { useParams, useRouter } from "next/navigation"
  import { Button } from "@/components/ui/button"
  import { Card, CardContent } from "@/components/ui/card"
  import { Badge } from "@/components/ui/badge"
  import { useGameStore, Player } from "@/lib/store"
  import "@tensorflow/tfjs-backend-webgl"; // Ensure WebGL backend is used for TensorFlow.js
  import { Zap, Heart, Users, Clock, Coins } from "lucide-react"
  import { getWebSocket } from "@/lib/websocket"
  import * as tf from "@tensorflow/tfjs";
  import { detectImage } from "./utils/detect";
  import { getClosestColor, hexToRgb, rgbToHex ,findClosestColor} from "@/lib/utils"

  export default function GamePage() {
    const params = useParams()
    const router = useRouter()
    const gameId = params.id as string
    const webSocket = getWebSocket();  
    const websocket = getWebSocket();  

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [cameraActive, setCameraActive] = useState(false)
    const [roomPlayers, setRoomPlayers] = useState<typeof players>([]);

    const [detectedColor, setDetectedColor] = useState<string | null>(null)
    const [lastAction, setLastAction] = useState<string>("")
    const streamRef = useRef<MediaStream | null>(null);

    //const { players, currentPlayer, gameTime, setGameTime, shootPlayer, healPlayer, shieldPlayer } = useGameStore();
    const players = useGameStore((state) => state.players);
    // const currentPlayer = useGameStore((state) => state.currentPlayer);
    const { currentPlayer, setCurrentPlayer } = useGameStore();
    const setPlayers = useGameStore((state) => state.setPlayers);
    const setGameTime = useGameStore((state) => state.setGameTime);
    const shootPlayer = useGameStore((state) => state.shootPlayer);
    const healPlayer = useGameStore((state) => state.healPlayer);
    const shieldPlayer = useGameStore((state) => state.shieldPlayer);
    const gameTime = useGameStore((state) => state.gameTime);

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

    // Weapon setup
    const weapons = [
      { name: "Knife", damage: 5, range: 25 },
      { name: "Basic Pistol", damage: 5, range: 50 },
      { name: "Shotgun", damage: 15, range: 75 },
      { name: "Rocket Launcher", damage: 30, range: 200 },
    ];
    let playerWeapon = weapons[1]; // basic pistol

    const randomiseWeapon = () => {
      return weapons[Math.floor( Math.random() * weapons.length )];
    }

    /*
    detectColor is also performing OCR
    */
  async function scanUser() {
    await loadAndPlaySound(); // Play sound on click

    if (!cameraActive || !videoRef.current || !canvasRef.current || net == null) {
      console.log("Scan user - missing requirements:", {
        cameraActive,
        videoRef: !!videoRef.current,
        canvasRef: !!canvasRef.current,
        net: !!net
      });
      return;
    }

    // Check if video is ready
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
      console.log("Video not ready for OCR");
      return;
    }

    console.log("Starting detection with OCR...");
    
    // Pass the callback function to handle detected players
    detectImage(
      videoRef.current, 
      net, 
      inputShape, 
      classThreshold, 
      canvasRef.current,
      handlePlayerDetected // New callback function
    );
  }

  useEffect(() => {
    websocket.emit("getRoomInfo",gameId);

    const handleUpdateRoom = (playersFromServer : typeof players)=>{
      useGameStore.getState().setPlayers(playersFromServer);
      setRoomPlayers(playersFromServer);
    }

    websocket.on("updateRoom", handleUpdateRoom);

     return () => {
        websocket.off("updateRoom", handleUpdateRoom);
      };
  }, [gameId])


useEffect(() => {
  if (videoRef.current && canvasRef.current && cameraActive) {
    const checkDimensions = () => {
      console.log("Video dimensions:", {
        videoWidth: videoRef.current?.videoWidth,
        videoHeight: videoRef.current?.videoHeight,
        canvasWidth: canvasRef.current?.width,
        canvasHeight: canvasRef.current?.height
      });
    };
    
    const interval = setInterval(checkDimensions, 5000);
    return () => clearInterval(interval);
  }
}, [cameraActive]);

  const handlePlayerDetected = async (detectedColor:{r:number,b:number,g:number}) => {
    if (!currentPlayer) return;

    console.log("Player detected in bounding box:", detectedColor);

    const now = Date.now();
    const lastActionTime = Number.parseInt(localStorage.getItem("lastActionTime") || "0");

    // Prevent spam (1 second cooldown)
    if (now - lastActionTime < 1000) return;

    localStorage.setItem("lastActionTime", now.toString());

    // setLastAction(`Targeting ${detectedColor}...`);
    
    try {
      let roomColours = roomPlayers.map(player => player.shootId.toLowerCase());

      let roomRGB = roomColours
        .map(color => hexToRgb(color))
        .filter((c): c is { r: number; g: number; b: number } => c !== null); // <-- filter nulls
      
      
      let detectedColorHex =  rgbToHex(detectedColor.r, detectedColor.g, detectedColor.b);

      // let closestColour = findClosestColor(detectedColorHex,roomColours);
      console.log("Detected color in hex:", detectedColorHex, "Room colors:", roomColours);
      let closestColour = getClosestColor(detectedColor,roomRGB);
      
      if (!closestColour) {
        console.error("No closest colour found");
        setLastAction("No target found.");
        return;
      }
      
      let closestHex = rgbToHex(closestColour.r, closestColour.g, closestColour.b);

      const matchedPlayer = roomPlayers.find(
        (player) => player.shootId.toLowerCase() === closestHex.toLowerCase()
      );

      if (matchedPlayer?.shootId== currentPlayer.shootId){
        console.log("You cannot shoot yourself!");
        // setLastAction("You cannot shoot yourself!");
        return;
      }


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
            shootId: matchedPlayer.shootId,
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
    }, [net, inputShape]);

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
            res.activePlayers.forEach((p) => {
              if (p.shootId === currentPlayer?.shootId) {
                setCurrentPlayer(p);
              }
            })
          }
        }
      )
    }, 2_000)

    return () => clearInterval(interval)
  }, [gameId, webSocket, setPlayers])
useEffect(() => {
  const timer = setInterval(() => {
    setGameTime(Math.max(0, gameTime - 1));
  }, 1000);

  if (gameTime === 0) {
    router.push(`/results/${gameId}`);
  }

  return () => clearInterval(timer);
}, [gameTime, gameId, router, setGameTime]);

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
          
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            setCameraActive(true)
            websocket.emit("playerReadyForStream", { gameId });
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
    if (!cameraActive || !streamRef.current || !websocket || !videoRef.current?.srcObject) return;

    const stream = streamRef.current;
    const peerConnections: { [id: string]: RTCPeerConnection } = {};
    
    console.log("Setting up WebRTC for game", gameId);
    
    // Tell server this player is ready to stream
    websocket.emit("playerReadyForStream", { gameId });

    // Handle spectator connection (hyphenated version)
    // In game.tsx - Fix the spectator connection handling
    const handleSpectatorConnected = async (spectatorId: string) => {
      console.log("Spectator connected:", spectatorId);

      const stream = streamRef.current;
      if (!stream || !stream.getTracks().length) {
        console.warn("No stream or tracks available at spectator connect");
        return; // Don't proceed without a valid stream
      }

      console.log("Stream details:", {
        id: stream.id,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        active: stream.active
      });

      try {
        const peer = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
          ],
        });

        if (!peerConnections[spectatorId]) {
          peerConnections[spectatorId] = peer;
        }

        // Add tracks BEFORE creating offer
        stream.getTracks().forEach(track => {
          console.log("Adding track to peer connection:", {
            kind: track.kind,
            enabled: track.enabled,
            readyState: track.readyState,
            id: track.id
          });
          peer.addTrack(track, stream);
        });

        // Handle ICE candidates
        peer.onicecandidate = (event) => {
          if (event.candidate) {
            console.log("Sending ICE candidate to spectator:", spectatorId);
            websocket.emit("webrtcCandidate", {
              to: spectatorId,
              candidate: event.candidate,
            });
          }
        };

        // Monitor connection state
        peer.onconnectionstatechange = () => {
          console.log(`Connection state with spectator ${spectatorId}:`, peer.connectionState);
        };

        peer.oniceconnectionstatechange = () => {
          console.log(`ICE connection state with spectator ${spectatorId}:`, peer.iceConnectionState);
        };

        // Create and send offer
        const offer = await peer.createOffer({
          offerToReceiveAudio: false, // We're only sending, not receiving
          offerToReceiveVideo: false
        });
        
        await peer.setLocalDescription(offer);
        
        console.log("Sending offer to spectator:", spectatorId, "SDP:", offer.sdp?.substring(0, 100) + "...");
        
        websocket.emit("webrtcOffer", {
          to: spectatorId,
          from: websocket.id,
          sdp: offer,
          gameId,
        });
      } catch (err) {
        console.error("Failed to handle spectator connection:", err);
      }
    };

    // Handle request for offer (alternative method)
    const handleRequestOffer = async ({ spectatorId }: { spectatorId: string }) => {
      console.log("Offer requested by spectator:", spectatorId);
      await handleSpectatorConnected(spectatorId);
    };

    // Handle answer from spectator
    const handleWebRTCAnswer = async ({ answer, from }: {answer: RTCSessionDescriptionInit; from: string }) => {
      console.log("Received WebRTC answer from:", from);
      const peer = peerConnections[from];
      if (peer) {
        try {
          await peer.setRemoteDescription(new RTCSessionDescription(answer));
          console.log("Successfully set remote description for spectator:", from);
        } catch (err) {
          console.error("Failed to set remote description:", err);
        }
      } else {
        console.warn("No peer connection found for spectator:", from);
      }
    };

    // Handle ICE candidates from spectator
    const handleWebRTCCandidate = async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      console.log("Received ICE candidate from:", from);
      const peer = peerConnections[from];
      if (peer && candidate) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("Successfully added ICE candidate from spectator:", from);
        } catch (err) {
          console.error("Failed to add ICE candidate:", err);
        }
      }
    };

    // Register event listeners
    websocket.on("spectator-connected", handleSpectatorConnected);
    websocket.on("requestOffer", handleRequestOffer);
    websocket.on("webrtcAnswer", handleWebRTCAnswer);
    websocket.on("webrtcCandidate", handleWebRTCCandidate);

    return () => {
      console.log("Cleaning up game WebRTC connections");
      
      // // Close all peer connections
      Object.values(peerConnections).forEach(pc => {
        if (pc) {
          pc.close();
        }
      });
      
      // Remove event listeners
      websocket.off("spectator-connected", handleSpectatorConnected);
      websocket.off("requestOffer", handleRequestOffer);
      websocket.off("webrtcAnswer", handleWebRTCAnswer);
      websocket.off("webrtcCandidate", handleWebRTCCandidate);
    };
  }, [cameraActive, gameId, websocket]);

    useEffect(() => {
      const handleUpdateRoom = (playersFromServer : typeof players)=>{
        useGameStore.getState().setPlayers(playersFromServer);
      }

      webSocket.on("updateRoom", handleUpdateRoom);
      webSocket.on('endSession', () => router.push(`/results/${gameId}`));
      webSocket.on('updateTimer', (timerVal) => {
        setGameTime(timerVal);
      });
      webSocket.on("updateRoom", handleUpdateRoom);
      webSocket.on('endSession', () => router.push(`/results/${gameId}`));
      webSocket.on('updateTimer', (timerVal) => {
        setGameTime(timerVal);

        // Randomise weapon on two min remaining
        if (timerVal === 120) {
          playerWeapon = randomiseWeapon();
          console.log(`Randomised weapon!`);
        }
      });
    },[]);

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
        <script async src="https://docs.opencv.org/4.x/opencv.js"></script>

        <div className="absolute inset-0">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"/>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />


          {/* Crosshair */}
          {/*<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {<div className="w-8 h-8 border-2 border-white rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>}
            <div
            className="border-2 border-white flex items-center justify-center"
            style={{
              width: '150px',
              height: '150px',
              borderRadius: '0',
            }}
          ></div>*/}
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
              <Button onClick={() => {
                webSocket.emit('endGame', gameId);
                router.push(`/results/${gameId}`);
            }} variant="destructive" className="w-full">
                End Game
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }
