export interface Session {
  authenticated(): Promise<boolean>;
  login(): Promise<void>;
  callback(): Promise<void>;
  token(force?: boolean): Promise<string>;
  logout(): Promise<void>;
}
