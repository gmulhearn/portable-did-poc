import express from "express";

export const server = express();

export const serverListener = server.listen(3000, (err?: any) => {
  if (err) throw err;
  console.log(
    "Server running on http://localhost:3000 (for did:web resolution)"
  );
});

