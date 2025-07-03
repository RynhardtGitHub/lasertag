// This file defines the types used in the backend of the game server.

export type JoinRoomResponse = {
  success: boolean;
  message?: string;
};


export interface Player {
  id: string
  name: string
  shootId: string
  health: number
  score: number
  weapon: [ string, number ]
  isAlive: boolean
  isHost?: boolean
  isSpectator?: boolean
  respawnScheduled?: boolean
}


export interface TriggerEventPayload {
    gameID: string,
    eventType: number;
    eventData: {
      weapon?: {
        name: string;
        damage: number;
        range: number;
      },
      [key: string]: any;
    };
}


export type GameEventData = {
  shooterId: string;
  targetId?: string;
  shootId?: string;
};


export interface SocketData {
  data:JSON
  playerId?: string;
  gameId?:string;
  role?: "player" | "spectator";
}
