require("dotenv").config();
const OpenAI = require('openai');
const express = require('express');
const { OPENAI_API_KEY, ASSISTANT_ID } = process.env;
const cors = require('cors');
const axios = require('axios');

// Setup Express
const app = express();
app.use(express.json());
app.use(cors());

// Set up OpenAI Client
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

const assistantId = ASSISTANT_ID;
let pollingInterval;

async function fetch_menu() {
    try {
        const response = await axios.get('https://api.cantinalacastellana.com/menu');
        return response.data;
    } catch (error) {
        console.error('Error fetching menu:', error);
        return null;
    }
}

async function createThread() {
    console.log('Creating a new thread...');
    const thread = await openai.beta.threads.create();
    return thread;
}

async function addMessage(threadId, message) {
    console.log('Adding a new message to thread: ' + threadId);
    const response = await openai.beta.threads.messages.create(
        threadId,
        {
            role: "user",
            content: message
        }
    );
    return response;
}

async function runAssistant(threadId) {
    console.log('Running assistant for thread: ' + threadId);
    const menu = await fetch_menu();
    if (!menu) {
        throw new Error('Failed to fetch menu');
    }
    const response = await openai.beta.threads.runs.create(
        threadId,
        { 
            assistant_id: assistantId,
            tools: [{ type: "function", function: { name: "fetch_menu" } }],
            additional_instructions: `
Here's the current menu: ${JSON.stringify(menu)}. Use this information when responding to customer queries about menu items. The menu is in Spanish, so respond accordingly.

Aquí está el menú actual: ${JSON.stringify(menu)}. Utiliza esta información al responder a las consultas de los clientes sobre los elementos del menú. El menú está en español, así que responde en consecuencia.

When asked about ingredients or dietary restrictions, always clarify that you don't have detailed information about ingredients and recommend the customer to ask the staff for specific details.

Cuando te pregunten sobre ingredientes o restricciones dietéticas, aclara siempre que no tienes información detallada sobre los ingredientes y recomienda al cliente que pregunte al personal por detalles específicos.`
        }
    );

    console.log(response);
    return response;
}

async function checkingStatus(res, threadId, runId) {
    const runObject = await openai.beta.threads.runs.retrieve(
        threadId,
        runId
    );

    const status = runObject.status;
    console.log(runObject);
    console.log('Current status: ' + status);
    
    if (status === 'completed') {
        clearInterval(pollingInterval);
        const messagesList = await openai.beta.threads.messages.list(threadId);
        let messages = [];
        messagesList.body.data.forEach(message => {
            messages.push(message.content);
        });
        res.json({ messages });
    } else if (status === 'requires_action') {
        clearInterval(pollingInterval);
        console.log('Action required:', runObject.required_action);
        // Here you would handle the required action
        // For now, we'll just send a message about the required action
        res.json({ status: 'requires_action', action: runObject.required_action });
    } else if (['failed', 'cancelled', 'expired'].includes(status)) {
        clearInterval(pollingInterval);
        res.status(500).json({ error: `Run ${status}`, details: runObject.last_error });
    }
    // If the status is still 'in_progress', we continue polling
}

app.get('/thread', (req, res) => {
    createThread().then(thread => {
        res.json({ threadId: thread.id });
    });
});

app.post('/message', (req, res) => {
    const { message, threadId } = req.body;
    addMessage(threadId, message).then(message => {
        runAssistant(threadId).then(run => {
            const runId = run.id;           
            pollingInterval = setInterval(() => {
                checkingStatus(res, threadId, runId);
            }, 5000);
        }).catch(error => {
            res.status(500).json({ error: error.message });
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});