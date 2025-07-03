import { Player } from "./types"

// Arsenal is a list of weapons available in the game, each with a name and damage value.
export const Arsenal: [string, number][] = [
  ["Knife", 5],
  ["Basic Pistol", 10],
  ["Shotgun", 20],
  ["Rocket Launcher", 45]
];

/**
 * Generates a random string of specified length using characters from the whitelist.
 * If no whitelist is provided, it defaults to alphanumeric characters.
 * @param {number} length - The length of the generated string.
 * @param {string|null} whitelist - Optional string of characters to use for generating the ID.
 * @returns {string} - The generated random string in uppercase.
 */
export function makeid(length:number, whitelist:string|null=null) {
    var result           = '';
    var characters       = !whitelist ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' : whitelist;
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result.toUpperCase();
}

/**
 * Creates a new player object with default values and overrides if provided.
 * @param {string} id - The unique identifier for the player.
 * @param {string} name - The name of the player.
 * @param {string} shootId - The shoot ID associated with the player.
 * @param {Partial<Omit<Player, 'id' | 'name'>>} options - Optional overrides for the player properties.
 * @returns {Player} - The newly created player object.
 */
export function createPlayer(
  id: string,
  name: string,
  shootId: string,
  options?: Partial<Omit<Player, 'id' | 'name'>>
): Player {
  return {
    id,
    name,
    shootId: shootId,
    health: 100,
    score: 0,
    weapon: Arsenal[1],
    isAlive: true,
    ...options, // override defaults if provided
  };
}
