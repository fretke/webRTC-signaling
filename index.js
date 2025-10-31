const express = require("express");
const http = require("http");
const path = require("path");
const WebSocket = require("ws");


const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });


// Serve demo client from ./public (created below in comment)
app.use(express.static(path.join(__dirname, "public")));


// Simple in-memory map of clients: clientId -> ws
const clients = new Map();


function makeId() {
    return Math.floor(Math.random() * 1e9).toString(36);
}


wss.on("connection", (ws) => {
    const id = makeId();
    clients.set(id, ws);
    ws.send(JSON.stringify({ type: "id", id }));
    console.log(`Client connected: ${id} (total ${clients.size})`);


    ws.on("message", (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch (e) {
            console.warn("ignoring non-json message");
            return;
        }


// Basic message format: { type: "offer"|"answer"|"ice"|"list"|"connect", to?:string, data: any }
        const { type, to, data } = msg;


        if (type === "list") {
// return list of other clients
            const other = Array.from(clients.keys()).filter((c) => c !== id);
            ws.send(JSON.stringify({ type: "list", clients: other }));
            return;
        }


        if (to) {
            const dest = clients.get(to);
            if (dest && dest.readyState === WebSocket.OPEN) {
                dest.send(JSON.stringify({ type, from: id, data }));
            } else {
                ws.send(JSON.stringify({ type: "error", message: "destination not available" }));
            }
            return;
        }


// If no "to" provided, broadcast to everyone except sender
        for (const [otherId, otherWs] of clients) {
            if (otherId === id) continue;
            if (otherWs.readyState === WebSocket.OPEN) {
                otherWs.send(JSON.stringify({ type, from: id, data }));
            }
        }
    });


    ws.on("close", () => {
        clients.delete(id);
        console.log(`Client disconnected: ${id} (total ${clients.size})`);
// notify remaining clients (optional)
        for (const otherWs of clients.values()) {
            if (otherWs.readyState === WebSocket.OPEN) {
                otherWs.send(JSON.stringify({ type: "peer-left", id }));
            }
        }
    });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Signaling server listening on http://localhost:${PORT}`));
