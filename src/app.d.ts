declare global {
  namespace App {
    interface Locals {
      playerId: string | null;
      isAdmin: boolean;
    }
    interface Error {
      message: string;
    }
  }
}
export {};
