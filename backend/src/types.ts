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

export type GameEventData = {
  shooterId: string;
  targetId?: string;
  shootId?: string;
};
