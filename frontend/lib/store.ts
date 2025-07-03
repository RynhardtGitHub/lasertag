import { create } from "zustand"

export interface Player {
  id: string
  name: string
  shootId: string
  health: number
  score: number
  weapon: string
  isAlive: boolean
  isHost?: boolean
  isSpectator?: boolean
  shirtColor: string
}

export interface GameState {
  gameId: string
  players: Player[]
  currentPlayer: Player | null
  gameStatus: "waiting" | "starting" | "active" | "ended"
  gameTime: number
  maxPlayers: number
}

interface GameStore extends GameState {
  setGameId: (id: string) => void
  addPlayer: (player: Player) => void
  removePlayer: (playerId: string) => void
  updatePlayer: (playerId: string, updates: Partial<Player>) => void
  setPlayers: (newPlayers: Player[]) => void
  setCurrentPlayer: (player: Player) => void
  setGameStatus: (status: GameState["gameStatus"]) => void
  setGameTime: (time: number) => void
  resetGame: () => void
  shootPlayer: (shooterId: string, targetId: string) => void
  healPlayer: (playerId: string) => void
  shieldPlayer: (playerId: string) => void
}

const initialState: GameState = {
  gameId: "",
  players: [],
  currentPlayer: null,
  gameStatus: "waiting",
  gameTime: 300, // 5 minutes
  maxPlayers: 8,
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  setGameId: (id) => set({ gameId: id }),

  addPlayer: (player) =>
    set((state) => ({
      players: [...state.players, player],
    })),

  removePlayer: (playerId) =>
    set((state) => ({
      players: state.players.filter((p) => p.id !== playerId),
    })),

  setPlayers:(newPlayers) => set({ players: newPlayers }),

  updatePlayer: (playerId, updates) =>
    set((state) => ({
      players: state.players.map((p) => (p.id === playerId ? { ...p, ...updates } : p)),
      currentPlayer:
        state.currentPlayer?.id === playerId ? { ...state.currentPlayer, ...updates } : state.currentPlayer,
    })),

  setCurrentPlayer: (player) => set({ currentPlayer: player }),

  setGameStatus: (status) => set({ gameStatus: status }),

  setGameTime: (time) => set({ gameTime: time }),

  resetGame: () => set(initialState),

  shootPlayer: (shooterId, targetId) => {
    const state = get()
    const shooter = state.players.find((p) => p.id === shooterId)
    const target = state.players.find((p) => p.id === targetId)

    if (shooter && target && target.isAlive) {
      set((state) => ({
        players: state.players.map((p) => {
          if (p.id === shooterId) {
            return { ...p, score: p.score + 10 }
          }
          if (p.id === targetId) {
            const newHealth = Math.max(0, p.health - 25)
            return {
              ...p,
              health: newHealth,
              isAlive: newHealth > 0,
            }
          }
          return p
        }),
      }))
    }
  },

  healPlayer: (playerId) =>
    set((state) => ({
      players: state.players.map((p) => (p.id === playerId ? { ...p, health: Math.min(100, p.health + 25) } : p)),
    })),

  shieldPlayer: (playerId) => {
    // Temporary shield effect - could be expanded
    console.log(`Shield activated for player ${playerId}`)
  },
}))
