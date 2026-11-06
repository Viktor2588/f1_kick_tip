// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    interface Locals {
      player: { id: string; name: string; isAdmin: boolean } | null;
    }
  }
}

export {};
