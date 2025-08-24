export interface User {
  id: string;
  email: string;
  emailVisibility: boolean;
  verified: boolean;
  created: string;
  updated: string;
  name: string;
  avatar: string;
}

export type AuthStatus =
  | "idle"
  | "checking"
  | "authenticating"
  | "success"
  | "error";

export interface AuthData {
  email: string;
  password: string;
}

export interface PostMessageData {
  type: string;
  data: AuthData;
}

export interface PocketBaseError {
  status: number;
  response: {
    code: number;
    message: string;
    data: Record<string, unknown>;
  };
  originalError?: Error;
}
