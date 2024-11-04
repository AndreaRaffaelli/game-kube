const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 3000;

// Oggetto per tenere traccia delle sessioni dei client
const sessions = {};

// Controller delle sessioni
const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';

// Intervallo di tempo massimo per considerare un heartbeat "valido" (in millisecondi)
const MAX_HEARTBEAT_AGE = 30000; // 30 secondi

app.use(express.json());

// Endpoint per ricevere gli heartbeat
app.post('/api/heartbeat', (req, res) => {
    const { clientId, sessionId } = req.body; // Assicurati che il client invii un identificatore unico e una stringa di sessione
    const timestamp = Date.now();

    // Se la sessione non esiste, creala
    if (!sessions[sessionId]) {
        sessions[sessionId] = { clients: {}, lastUpdated: timestamp };
    }

    // Aggiorna o crea la sessione del client
    sessions[sessionId].clients[clientId] = timestamp;
    sessions[sessionId].lastUpdated = timestamp;

    res.json({ status: 'ok', timestamp });
});

// Funzione per verificare le sessioni scadute
function checkExpiredSessions() {
    const now = Date.now();
    for (const sessionId in sessions) {
        const session = sessions[sessionId];
        // Controlla i client nella sessione
        for (const clientId in session.clients) {
            if (now - session.clients[clientId] > MAX_HEARTBEAT_AGE) {
                console.log(`Sessione scaduta per il client: ${clientId} nella sessione: ${sessionId}`);
                delete session.clients[clientId]; // Rimuovi il client scaduto
            }
        }

        // Se non ci sono più client nella sessione, rimuovi la sessione
        if (Object.keys(session.clients).length === 0) {
            console.log(`Rimozione della sessione: ${sessionId} poiché non ci sono più client collegati.`);
            delete sessions[sessionId];
            const response = axios.post(`${backendUrl}/api/destroy-session`, { sessionCode: sessionId });
            console.log(`Sessione ${sessionId} distrutta con successo sul backend.`);
        }
    }
}

// Controlla le sessioni scadute ogni 5 secondi
setInterval(checkExpiredSessions, 5000);

// Avvia il server
app.listen(PORT, () => {
    console.log(`Server in ascolto su http://localhost:${PORT}`);
});
