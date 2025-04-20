require("dotenv").config();
const OpenAI = require('openai');
const express = require('express');
const { 
    OPENAI_API_KEY, 
    ASSISTANT_ID,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_FROM,
    ADMIN_WHATSAPP_NUMBER
} = process.env;
const cors = require('cors');
const axios = require('axios');
const { sendReservation, validateReservation, getCurrentMexicoDate } = require('./emails');
const { sendTemplateMessage, notifyReservationWhatsApp } = require('./twilio');

// Setup Express
const app = express();
app.use(express.json());
app.use(cors());

// Set up OpenAI Client
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

// Assistant ID
const assistantId = ASSISTANT_ID;

// Function to fetch the menu
async function fetch_menu() {
    try {
        const response = await axios.get('https://api.cantinalacastellana.com/menu');
        return response.data;
    } catch (error) {
        console.error('Error fetching menu:', error);
        return null;
    }
}

// AI tools definition
const tools = [
    {
        type: "function",
        function: {
            name: "fetch_menu",
            description: "Fetches the menu from our API and sends it as context to the assistant",
            parameters: {
                type: "object",
                properties: {},
                required: [],
                additionalProperties: false
            },
            strict: true,
        }
    },
    {
        type: "function",
        function: {
            name: "get_current_date",
            description: "Returns the current date in Mexico City",
            parameters: {
                type: "object",
                properties: {},
                required: [],
                additionalProperties: false
            },
            strict: true
        }
    },
    {
        type: "function",
        function: {
            name: "make_reservation",
            description: "Makes a restaurant reservation. Call get_current_date first to check date availability",
            parameters: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "Full name of the person making the reservation"
                    },
                    phone: {
                        type: "string",
                        description: "Contact phone number (e.g., +52 123-456-7890)"
                    },
                    date: {
                        type: "string",
                        description: "Reservation date in YYYY-MM-DD format"
                    },
                    guests: {
                        type: "integer",
                        description: "Number of guests"
                    }
                },
                required: ["name", "phone", "date", "guests"],
                additionalProperties: false
            },
            strict: true
        }
    }
];

// Thread management functions
async function createThread() {
    console.log('Creating a new thread...');
    return await openai.beta.threads.create();
}

async function addMessage(threadId, message) {
    console.log('Adding message to thread:', threadId);
    return await openai.beta.threads.messages.create(
        threadId,
        { role: "user", content: message }
    );
}

async function runAssistant(threadId) {
    console.log('Running assistant for thread:', threadId);
    return await openai.beta.threads.runs.create(
        threadId,
        { assistant_id: assistantId, tools: tools }
    );
}

// Function to process tool calls
async function processToolCalls(toolCalls) {
    const toolOutputs = [];
    
    for (const toolCall of toolCalls) {
        let output;
        
        switch (toolCall.function.name) {
            case 'fetch_menu':
                output = await fetch_menu();
                break;
                
            case 'get_current_date':
                const currentDate = new Date().toLocaleString('es-MX', {
                    timeZone: 'America/Mexico_City',
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                const isoDate = new Date(new Date().toLocaleString('en-US', {
                    timeZone: 'America/Mexico_City'
                })).toISOString().split('T')[0];
                
                output = {
                    currentDate,
                    isoDate,
                    message: `La fecha actual en Ciudad de México es ${currentDate}.`
                };
                break;
                
            case 'make_reservation':
                const reservationData = JSON.parse(toolCall.function.arguments);
                const reservationResult = await sendReservation(reservationData);

                if (reservationResult.success) {
                    await notifyReservationWhatsApp({
                        ...reservationData,
                        formattedDate: reservationResult.formattedDate
                    });
                }
                
                output = {
                    ...reservationResult,
                    whatsappSent: reservationResult.success
                };
                break;
                
            default:
                output = { error: 'Función no reconocida' };
        }
        
        toolOutputs.push({
            tool_call_id: toolCall.id,
            output: JSON.stringify(output)
        });
    }
    
    return toolOutputs;
}

// Function to handle the assistant's run status
async function handleRunStatus(threadId, runId) {
    let run;
    let messages;
    
    while (true) {
        run = await openai.beta.threads.runs.retrieve(threadId, runId);
        console.log('Run status:', run.status);
        
        switch (run.status) {
            case 'completed':
                const messagesList = await openai.beta.threads.messages.list(threadId);
                messages = messagesList.data.map(message => message.content);
                return { status: 'completed', messages };
                
            case 'requires_action':
                if (run.required_action.type === 'submit_tool_outputs') {
                    const toolOutputs = await processToolCalls(
                        run.required_action.submit_tool_outputs.tool_calls
                    );
                    
                    await openai.beta.threads.runs.submitToolOutputs(
                        threadId,
                        runId,
                        { tool_outputs: toolOutputs }
                    );
                }
                break;
                
            case 'failed':
            case 'expired':
            case 'cancelled':
                throw new Error(`Run failed with status: ${run.status}`);
                
            default:
                await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Routes
app.get('/thread', async (req, res) => {
    try {
        const thread = await createThread();
        res.json({ threadId: thread.id });
    } catch (error) {
        console.error('Error creating thread:', error);
        res.status(500).json({ error: 'Error creating thread' });
    }
});

app.post('/message', async (req, res) => {
    const { message, threadId } = req.body;
    
    try {
        await addMessage(threadId, message);
        const run = await runAssistant(threadId);
        const result = await handleRunStatus(threadId, run.id);
        res.json(result);
    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({ 
            error: 'Error processing message',
            message: error.message 
        });
    }
});

/// Whatsapp test endpoint - updated to use templates only
app.post('/test-whatsapp', async (req, res) => {
    const { message, useTemplate } = req.body;
    
    try {
        // We now always use templates since free-form messages are no longer supported
        // Check if template SID exists
        if (!process.env.TWILIO_TEMPLATE_SID) {
            return res.status(400).json({
                success: false,
                error: 'TWILIO_TEMPLATE_SID not configured. WhatsApp now requires templates for business-initiated messages.'
            });
        }
        
        // Use provided variables or defaults
        const variables = req.body.variables || { 
            "1": "Mensaje de prueba", 
            "2": new Date().toLocaleString('es-MX'), 
            "3": "Cantina La Castellana" 
        };
        
        const result = await sendTemplateMessage(
            ADMIN_WHATSAPP_NUMBER,
            process.env.TWILIO_TEMPLATE_SID,
            variables
        );
        
        res.json(result);
    } catch (error) {
        console.error('Error sending WhatsApp test message:', error);
        res.status(500).json({ 
            error: 'Error sending WhatsApp message',
            message: error.message 
        });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});