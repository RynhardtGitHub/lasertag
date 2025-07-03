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
import {hexToRgb, rgbToHex, Color} from "@/lib/utils"


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


  const [loading, setLoading] = useState({ loading: true, progress: 0 }); // loading state
    //YOLO START
  const [net,setNet]= useState<tf.GraphModel | null>(null); // YOLO model state
  const [inputShape,setInputShape] = useState<any>(null) // YOLO model state
  const [modelReady, setModelReady] = useState(false);
  let damageAmplifier = 1; // Default damage multiplier

  // references
  const imageRef = useRef(null);
  const cameraRef = useRef(null);
  

  // model configs
  const modelName = "yolov5n";
  const classThreshold = 0.5;
  //YOLO END
    
  //USE EFFECTS START
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
            // websocket.emit("playerReadyForStream", { gameId });
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
    }, [cameraActive, gameId, webSocket]);


  useEffect(() => {
      const handleUpdateRoom = (playersFromServer : typeof players)=>{
        useGameStore.getState().setPlayers(playersFromServer);
      }

      webSocket.on("updateRoom", handleUpdateRoom);
      webSocket.on('endSession', () => router.push(`/results/${gameId}`));
      webSocket.on('updateTimer', (timerVal) => {
        setGameTime(timerVal);
        
        if (timerVal%30==0 && timerVal > 0) {
          const randomWeapon = randomiseWeapon();
          setCurrentWeapon(randomWeapon);
        }

        // Random powerup every 10 seconds (you can change this to 60 for every minute)
        if (timerVal % 60 === 0 && timerVal > 0 && timerVal !== lastPowerupTime) {
          setLastPowerupTime(timerVal);
          
          const randomPowerup = randomizePowerup();
          console.log(`Randomised powerup: ${randomPowerup.name}`);
          
          if (randomPowerup.type === "heal") {
            webSocket.emit("triggerEvent", {
              gameID: `${gameId}`,
              eventType: 1, // Heal event type
              eventData: {
                playerId: currentPlayer?.shootId,
                healAmount: randomPowerup.healAmount
              }
            });
          } else if (randomPowerup.type === "shield") {
            console.log(`Shield powerup: ${randomPowerup.name} (Shield: ${randomPowerup.shieldAmount})`);
            // Note: Shield will be applied when player uses it
          } else if (randomPowerup.type === "buff") {
            console.log(`New buff: ${randomPowerup.name}`);
            // Buff is automatically applied in randomizePowerup function

            setActiveBuff({
              ...randomPowerup,
              remainingTime: randomPowerup.duration
            });
          }
        }
      });

      return () => {
        webSocket.off("updateRoom", handleUpdateRoom);
        webSocket.off('endSession',()=>{});
        webSocket.off('updateTimer',()=>{});
      };
      }, []);


    // POWERUPS START
  const powerups = [
      { name: "Heal Pack", type: "heal", healAmount: 25, icon: "💚", color: "text-green-400" },
      { name: "Shield Boost", type: "shield", shieldAmount: 25, icon: "🛡️", color: "text-cyan-400" },
      { name: "Double Damage", type: "buff", multiplier: 2, duration: 30, icon: "⚔️", color: "text-yellow-400" },
      { name: "Resistance", type: "buff", damageReduction: 0.2, duration: 30, icon: "🛡️", color: "text-purple-400" }
    ];
  const weapons = [
      { name: "Knife", damage: 5, range: 25 },
      { name: "Basic Pistol", damage: 5, range: 50 },
      { name: "Shotgun", damage: 15, range: 75 },
      { name: "Rocket Launcher", damage: 30, range: 200 },
    ];
  const [currentPowerup, setCurrentPowerup] = useState(powerups[0]); // Start with laser gun
  const [powerupTimer, setPowerupTimer] = useState(30); // 30 seconds until next powerup
  const [activeBuff, setActiveBuff] = useState<{
    name: string;
    type: string;
    multiplier?: number;
    damageReduction?: number;
    duration: number;
    remainingTime: number;
    icon: string;
    color: string;
  } | null>(null);// Track active buffs
  const [currentWeapon, setCurrentWeapon] = useState(weapons[1]); 
  const [lastPowerupTime, setLastPowerupTime] = useState(0);
  const weaponRef = useRef(currentWeapon);


  useEffect(() => {
    weaponRef.current = currentWeapon;
    console.log("Current weapon updated:", currentWeapon);
  }, [currentWeapon]);


  const randomiseWeapon = () => {
    return weapons[Math.floor( Math.random() * weapons.length )];
  }


  const randomizePowerup = () => {
      const newPowerup = powerups[Math.floor(Math.random() * powerups.length)];
      setCurrentPowerup(newPowerup);
      setPowerupTimer(10); // Reset timer
      
      // Play a powerup sound or visual effect
      console.log(`New powerup acquired: ${newPowerup.name}`);
      
      // If it's a buff, activate it
      if (newPowerup.type === 'buff') {
        setActiveBuff({
          ...newPowerup,
          remainingTime: newPowerup.duration
        });
      }
      
      return newPowerup;
    };
  // POWERUPS END

  // AUDIO START
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

  //AUDIO END

  // Function to handle user click and start detection
  async function scanUser() {
    if (weaponRef.current.name === "Knife") {
      await loadAndPlaySound("/sounds/knife.mp3"); // Play sound on click
    }else if (weaponRef.current.name === "Basic Pistol") {
      await loadAndPlaySound("/sounds/pew.mp3"); // Play sound on click
    }else if (weaponRef.current.name === "Shotgun") {
      await loadAndPlaySound("/sounds/shotgun.mp3"); // Play sound on click
    }else if (weaponRef.current.name === "Rocket Launcher") {
      await loadAndPlaySound("/sounds/rocket.mp3"); // Play sound on click
    }


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


  const handlePlayerDetected = async (detectedColor:Color) => {
    if (!currentPlayer) return;

    console.log("Raw detected color:", detectedColor);

    const now = Date.now();
    const lastActionTime = Number.parseInt(localStorage.getItem("lastActionTime") || "0");

    // Prevent spam (reduce to 800ms for better responsiveness)
    if (now - lastActionTime < 800) return;

    try {
      // Validate detected color
      if (!detectedColor || typeof detectedColor.r !== 'number' || 
          detectedColor.r < 0 || detectedColor.r > 255) {
        console.log("Invalid detected color:", detectedColor);
        return;
      }

      // Get room colors and convert to RGB
      let roomColours = roomPlayers.map(player => player.shootId.toLowerCase());
      console.log("Room hex colors:", roomColours);

      let roomRGB = roomColours
        .map(color => hexToRgb(color))
        .filter((c) => c !== null);
      
      console.log("Room RGB colors:", roomRGB);

      if (roomRGB.length === 0) {
        console.log("No valid room colors found");
        return;
      }

      // Use improved color matching
      let closestColour = getClosestColorWithThreshold(detectedColor, roomRGB, 100);
      
      if (!closestColour) {
        console.log("No close color match found");
        setLastAction("No target found.");
        setTimeout(() => setLastAction(""), 1500);
        return;
      }
      
      let closestHex = rgbToHex(closestColour.r, closestColour.g, closestColour.b);
      console.log("Closest match:", closestColour, "->", closestHex);

      const matchedPlayer = roomPlayers.find(
        (player) => player.shootId.toLowerCase() === closestHex.toLowerCase()
      );

      // Prevent self-targeting
      if (matchedPlayer?.shootId === currentPlayer.shootId) {
        console.log("Cannot target yourself");
        setLastAction("Cannot target yourself!");
        setTimeout(() => setLastAction(""), 1500);
        return;
      }

      if (matchedPlayer) {
        console.log("Target acquired:", matchedPlayer.name);
        
        // Store action time before emitting
        localStorage.setItem("lastActionTime", now.toString());

          // Emit the shoot event
          //TODO UNCHANGE IF BREAK
          let tempWeapon = weaponRef.current;
          tempWeapon.damage = Math.floor(tempWeapon.damage * (activeBuff?.multiplier || 1));
          console.log("Adjusted weapon damage:", tempWeapon.damage);

          webSocket.emit("triggerEvent", {
            gameID: `${gameId}`,
            eventType: 0,
            eventData: {
              shooter: currentPlayer.shootId,
              victim: matchedPlayer.shootId,
              weapon: tempWeapon
            }
          });

        console.log("Shoot event triggered for", matchedPlayer.name);
        setLastAction(`🎯 Shot ${matchedPlayer.name}!`);
      } else {
        console.log("No matching player found for color:", closestHex);
        setLastAction("❌ Target not found");
      }
    } catch (err) {
      console.error("Failed to process player detection:", err);
      setLastAction("⚠️ Detection error");
    }

    setTimeout(() => setLastAction(""), 2000);
  };


// Enhanced color matching function
  function getClosestColorWithThreshold(
    targetColor:Color,
    colorList:Array<Color>,
    threshold = 100
  ) {
    if (!targetColor || !colorList || colorList.length === 0) {
      return null;
    }

    let closest = null;
    let minDistance = Infinity;

    console.log("Comparing target:", targetColor);

    for (const color of colorList) {
      if (!color || typeof color.r !== 'number') {
        continue;
      }

      // Use improved perceptual distance
      const dr = targetColor.r - color.r;
      const dg = targetColor.g - color.g;
      const db = targetColor.b - color.b;
      
      // Perceptual color difference (weighted for human vision)
      const distance = Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db);
      
      console.log(`Distance to RGB(${color.r},${color.g},${color.b}): ${distance.toFixed(2)}`);

      if (distance < minDistance) {
        minDistance = distance;
        closest = color;
      }
    }

    console.log("Best match:", closest, "distance:", minDistance.toFixed(2));
    
    // Only return if within threshold
    if (minDistance <= threshold) {
      return closest;
    }
    
    console.log("No color within threshold of", threshold);
    return null;
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
          {/* {<div className={`absolute ${currentPlayer.isHost ? 'bottom-20' : 'bottom-4'} left-4 right-4`}>
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
          </div>} */}
          <div className={`absolute ${currentPlayer.isHost ? 'bottom-20' : 'bottom-4'} left-4 right-4`}>
  <Card className="bg-black/70 border-gray-600">
    <CardContent className="p-3">
      <div className="flex items-center justify-between text-white text-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg">{currentPowerup.icon || '🔫'}</span>
          <div className="flex flex-col">
            <span className={`font-bold ${currentPowerup.color || 'text-white'}`}>
              Current Powerup: {currentPowerup.name}
            </span>
            <span className="text-xs text-gray-400">
              {currentPowerup.type === 'heal' && `Heals: ${currentPowerup.healAmount} HP`}
              {currentPowerup.type === 'shield' && `Shield: ${currentPowerup.shieldAmount}`}
              {currentPowerup.type === 'buff' && currentPowerup.name === 'Double Damage' && `2x Damage for ${currentPowerup.duration}s`}
              {currentPowerup.type === 'buff' && currentPowerup.name === 'Resistance' && `20% less damage for ${currentPowerup.duration}s`}
            </span>
          </div>
        </div>
         {/* Powerup Timer */}
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            <span className="text-xs">Next: {powerupTimer}s</span>
          </div>
          
          {/* Active Buff Display */}
          {activeBuff && (
            <Badge variant="outline" className={`${activeBuff.color} border-current text-xs`}>
              {activeBuff.name}: {activeBuff.remainingTime}s
            </Badge>
          )}
        </div>
        
        <div className="flex flex-col items-end gap-1">
          {/* Current Weapon Display */}
          {currentWeapon && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-yellow-400">Current Weapon:</span>
              <Badge variant="outline" className="text-yellow-400 border-yellow-400 text-xs">
                {currentWeapon.name}
              </Badge>
            </div>
          )}
          
         
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

          {!currentPlayer.isAlive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50 pointer-events-auto">
              <Card className="bg-red-900/90 border-red-600 p-8 text-center animate-pulse">
                <span className="text-white text-4xl font-bold mb-4">YOU ARE DEAD!</span>
                <CardContent className="text-red-200 text-lg">
                  <p>Wait for the next round or for a revive.</p>
                  <p className="mt-2">No more shooting for you.</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    )

}
