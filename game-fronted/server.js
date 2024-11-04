/**
 * Questo è il server Node.js che gestisce le richieste HTTP per il frontend del gioco.
 */
const express = require('express');
const path = require('path');
const axios = require('axios');
const { allowedNodeEnvironmentFlags } = require('process');

const app = express();
const PORT = process.env.PORT || 3000;

const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';

// Middleware per il parsing del corpo delle richieste
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servire i file statici
app.use(express.static(path.join(__dirname, 'public')));

// Rotta per creare una nuova sessione di gioco
app.post('/api/start-game', async (req, res) => {
    try {
        // Genera un codice di sessione unico
        const sessionCode = Math.random().toString(36).substring(2, 8);

        // Invia una richiesta al backend per avviare un nuovo container di gioco
        const response = await axios.post(`${backendUrl}/api/create-game`, { sessionCode });

        // Restituisci l'URL del container di gioco
        res.json({ sessionCode, gameUrl: response.data.gameUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Errore nella creazione della sessione di gioco' });
    }
});

// Rotta per accedere a una sessione esistente
app.post('/api/join-game', async (req, res) => {
    const { sessionCode } = req.body;

    try {
        // Verifica il codice di sessione con il backend
        const response = await axios.get(`${backendUrl}/api/get-game/${sessionCode}`);

        // Restituisci l'URL del container di gioco
        res.json({ gameUrl: response.data.gameUrl });
    } catch (error) {
        console.error(error);
        res.status(404).json({ error: 'Sessione di gioco non trovata' });
    }
});

app.post('/api/end-game', async (req, res) => {
    // Recupera il codice di sessione dalla richiesta
    // Controllare se numero di client connessi è 0
    // se si' eliminare il container
});
// Avvia il server
app.listen(PORT, () => {
    console.log(`Server in ascolto su http://localhost:${PORT}`);
});
