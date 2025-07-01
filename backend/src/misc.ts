import { Player } from "./types"


export function makeid(length:number) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result.toUpperCase();
}


export function createPlayer(
  id: string,
  name: string,
  options?: Partial<Omit<Player, 'id' | 'name'>>
): Player {
  return {
    id,
    name,
    health: 100,
    score: 0,
    weapon: "Basic Laser",
    isAlive: true,
    ...options, // override defaults if provided
  };
}
