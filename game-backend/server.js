const express = require('express');
const bodyParser = require('body-parser');
const { KubeConfig, CoreV1Api } = require('@kubernetes/client-node');
const { createGameContainer } = require('./gameSessions');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware per il parsing del corpo delle richieste
app.use(bodyParser.json());

// Configurazione di Kubernetes
const kubeConfig = new KubeConfig();
kubeConfig.loadFromDefault();
const k8sApi = kubeConfig.makeApiClient(CoreV1Api);

// Memoria per le sessioni di gioco
const gameSessions = {};

// Rotta per creare una nuova sessione di gioco
app.post('/api/create-game', async (req, res) => {
    const { sessionCode } = req.body;

    try {
        // Crea un nuovo container di gioco
        const gameUrl = await createGameContainer(sessionCode, k8sApi);
        
        // Salva la sessione di gioco
        gameSessions[sessionCode] = { gameUrl, status: 'active' };

        res.json({ gameUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Errore nella creazione della sessione di gioco' });
    }
});

// Rotta per ottenere informazioni su una sessione di gioco esistente
app.get('/api/get-game/:sessionCode', (req, res) => {
    const { sessionCode } = req.params;

    const session = gameSessions[sessionCode];
    if (session) {
        res.json({ gameUrl: session.gameUrl });
    } else {
        res.status(404).json({ error: 'Sessione di gioco non trovata' });
    }
});

// Avvia il server
app.listen(PORT, () => {
    console.log(`Server in ascolto su http://localhost:${PORT}`);
});
