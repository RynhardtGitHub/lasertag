export type JoinRoomResponse = {
  success: boolean;
  message?: string;
};


export interface Player {
  id: string
  name: string
  health: number
  score: number
  weapon: string
  isAlive: boolean
  isHost?: boolean
  isSpectator?: boolean
}


