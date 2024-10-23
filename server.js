require("dotenv").config();
const OpenAI = require('openai');
const express = require('express');
const { OPENAI_API_KEY, ASSISTANT_ID } = process.env;
const cors = require('cors');
const axios = require('axios');
const { sendReservation, validateReservation, getCurrentMexicoDate } = require('./emails');

// Setup Express
const app = express();
app.use(express.json()); // Middleware to parse JSON bodies
app.use(cors()); // Middleware to enable CORS

// Set up OpenAI Client
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

// Assistant can be created via API or UI
const assistantId = ASSISTANT_ID;
let pollingInterval;

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

// AI tools to be used in the assistant
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
                        description: "Number of guests (must be between 1 and 20 people)"
                    }
                },
                required: ["name", "phone", "date", "guests"],
                additionalProperties: false
            },
            strict: true
        }
    }
];

// Set up a Thread
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
    console.log('Running assistant for thread: ' + threadId)
    const response = await openai.beta.threads.runs.create(
        threadId,
        { 
          assistant_id: assistantId,
          tools: tools,
        }
      );

    return response;
}

async function checkingStatus(res, threadId, runId) {
    const runObject = await openai.beta.threads.runs.retrieve(threadId, runId);
    const status = runObject.status;
    
    if (status === 'requires_action') {
        clearInterval(pollingInterval);
        
        if (runObject.required_action.type === 'submit_tool_outputs') {
            const toolCalls = runObject.required_action.submit_tool_outputs.tool_calls;
            const toolOutputs = [];

            for (const toolCall of toolCalls) {
                if (toolCall.function.name === 'fetch_menu') {
                    const menu = await fetch_menu();
                    toolOutputs.push({
                        tool_call_id: toolCall.id,
                        output: JSON.stringify(menu)
                    });
                }
                else if (toolCall.function.name === 'get_current_date') {
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

                    toolOutputs.push({
                        tool_call_id: toolCall.id,
                        output: JSON.stringify({
                            currentDate: currentDate,
                            isoDate: isoDate,
                            message: `La fecha actual en Ciudad de México es ${currentDate}.`
                        })
                    });
                }
                else if (toolCall.function.name === 'make_reservation') {
                    const result = await sendReservation(JSON.parse(toolCall.function.arguments));
                    toolOutputs.push({
                        tool_call_id: toolCall.id,
                        output: JSON.stringify(result)
                    });
                }
            }

            await openai.beta.threads.runs.submitToolOutputs(
                threadId,
                runId,
                { tool_outputs: toolOutputs }
            );

            pollingInterval = setInterval(() => {
                checkingStatus(res, threadId, runId);
            }, 3000);
        }
    } else if(status === 'completed') {
        clearInterval(pollingInterval);

        const messagesList = await openai.beta.threads.messages.list(threadId);
        let messages = []
        
        messagesList.body.data.forEach(message => {
            messages.push(message.content);
        });

        res.json({ messages });
    }
}

//=========================================================
//============== ROUTE SERVER =============================
//=========================================================

// Open a new thread
app.get('/thread', (req, res) => {
    createThread().then(thread => {
        res.json({ threadId: thread.id });
    });
})

app.post('/message', (req, res) => {
    const { message, threadId } = req.body;
    addMessage(threadId, message).then(message => {
        // Run the assistant
        runAssistant(threadId).then(run => {
            const runId = run.id;           
            
            // Check the status
            pollingInterval = setInterval(() => {
                checkingStatus(res, threadId, runId);
            }, 5000);
        });
    });
  });

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});