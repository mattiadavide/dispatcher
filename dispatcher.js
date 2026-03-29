const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const cors = require('cors');
const crypto = require('crypto');
const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const nodes = new Map();
wss.on('connection', (ws) => {
    const id = crypto.randomUUID();
    nodes.set(id, ws);
    console.log(`[+] NODE_SIGNALING_ACTIVE: ${id}`);
    ws.send(JSON.stringify({ type: 'SIGNALING_READY', id }));
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'LIST_NODES') {
                const list = Array.from(nodes.keys()).filter(nodeId => nodeId !== id);
                ws.send(JSON.stringify({ type: 'NODE_LIST', nodes: list }));
            } else if (['OFFER', 'ANSWER', 'ICE_CANDIDATE'].includes(data.type)) {
                const target = nodes.get(data.target);
                if (target) {
                    target.send(JSON.stringify({
                        type: data.type,
                        sender: id,
                        payload: data.payload
                    }));
                }
            }
        } catch (e) {
            console.error('[!] SIGNAL_ERROR:', e.message);
        }
    });
    ws.on('close', () => {
        console.log(`[-] NODE_SIGNALING_DEACTIVATED: ${id}`);
        nodes.delete(id);
    });
});
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`[ SIGNALING_SERVER_ACTIVE ] PORT:${PORT}`));

