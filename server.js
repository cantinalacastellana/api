require("dotenv").config();
const OpenAI = require('openai');
const express = require('express');
const { OPENAI_API_KEY, ASSISTANT_ID } = process.env;
const cors = require('cors');
const axios = require('axios');

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

// Define the tools array with the fetch_menu function
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
    const runObject = await openai.beta.threads.runs.retrieve(
        threadId,
        runId
    );

    const status = runObject.status;
    
    console.log('Current status: ' + status);
    
    if(status === 'completed') {
        clearInterval(pollingInterval);

        const messagesList = await openai.beta.threads.messages.list(threadId);
        let messages = []
        
        messagesList.body.data.forEach(message => {
            messages.push(message.content);
        });

        res.json({ messages });
    } else if (status === 'requires_action') {
        clearInterval(pollingInterval);
        console.log('Action required:', runObject.required_action);
        
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
            }

            await openai.beta.threads.runs.submitToolOutputs(
                threadId,
                runId,
                { tool_outputs: toolOutputs }
            );

            pollingInterval = setInterval(() => {
                checkingStatus(res, threadId, runId);
            }, 5000);
        }
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