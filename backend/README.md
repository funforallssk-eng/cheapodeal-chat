# Backend - Token Server
Deploy this to Render.com - it holds your App Secret safely.

Env needed:
NEXCONN_APP_SECRET=yWj2hyXUWFJ

Test:
POST /api/token { "userId": "test1" } => { accessToken }

This token is used by frontend to connect to Nexconn.
