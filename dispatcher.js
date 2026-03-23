const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const availableNodes = new Set();
const pendingTasks = new Map();

wss.on('connection', (ws) => {
    console.log('[+] NODE_ACTIVE');
    availableNodes.add(ws);

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'COMPUTE_RESULT' && pendingTasks.has(data.taskId)) {
            const res = pendingTasks.get(data.taskId);
            
            res.json({
                id: data.taskId,
                object: "chat.completion",
                choices: [{
                    message: { role: "assistant", content: data.result }
                }]
            });
            
            pendingTasks.delete(data.taskId);
            availableNodes.add(ws); 
        }
    });

    ws.on('close', () => {
        console.log('[-] NODE_DEACTIVATED');
        availableNodes.delete(ws);
    });
});

app.post('/v1/chat/completions', (req, res) => {
    if (availableNodes.size === 0) {
        return res.status(503).json({ error: "ERR_NO_ACTIVE_NODES" });
    }

    const taskId = 'TASK_' + Date.now();
    const prompt = req.body.messages; 
    
    const node = Array.from(availableNodes)[0];
    availableNodes.delete(node); 

    pendingTasks.set(taskId, res);

    node.send(JSON.stringify({
        type: 'EXECUTE_COMPUTE',
        taskId: taskId,
        payload: prompt
    }));
    
    console.log(`[>] TASK_${taskId}_DISPATCHED`);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`[ DISPATCHER_ACTIVE ] PORT:${PORT}`);
});
