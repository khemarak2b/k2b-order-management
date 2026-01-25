declare namespace Express {
  interface Request {
    pool: any;
    cognitoAuthProvider: string;
  }
}
