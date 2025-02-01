const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const FormData = require('form-data');

// Configuration from environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const API_BASE_URL = process.env.API_BASE_URL;
const DISPLAY_ID = process.env.DISPLAY_ID;

if (!BOT_TOKEN || !API_BASE_URL || !DISPLAY_ID) {
    console.error('Missing required environment variables: BOT_TOKEN, API_BASE_URL, or DISPLAY_ID');
    process.exit(1);
}

// Create a bot instance
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Handle incoming messages
bot.on('message', async (msg) => {
    try {
        // Check if message contains a photo (works for both direct sends and forwards)
        if (msg.photo) {
            const chat_id = msg.chat.id;

            // Log info about the message
            console.log(`Processing image from chat ${chat_id}${msg.forward_from ? ' (forwarded)' : ''}`);

            await bot.sendMessage(chat_id, '📝 Processing your image...');

            // Get the largest photo version (last in array)
            const photo = msg.photo[msg.photo.length - 1];
            const file = await bot.getFile(photo.file_id);
            const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

            // Download the image
            const response = await axios({
                url: fileUrl,
                method: 'GET',
                responseType: 'arraybuffer'
            });

            // Create form data
            const formData = new FormData();
            formData.append('image', Buffer.from(response.data), {
                filename: 'image.jpg',
                contentType: 'image/jpeg'
            });

            // Send to display API
            const apiResponse = await axios.post(
                `${API_BASE_URL}/displays/${DISPLAY_ID}/image`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders()
                    }
                }
            );

            // Check display status
            const statusResponse = await axios.get(
                `${API_BASE_URL}/displays/${DISPLAY_ID}/drawing-status`
            );

            await bot.sendMessage(
                chat_id,
                `✅ Image processed successfully!\n` +
                `Status: ${apiResponse.data.status}\n` +
                `Drawing: ${statusResponse.data.isDrawing ? 'Yes' : 'No'}\n` +
                `Pending: ${statusResponse.data.hasPendingImage ? 'Yes' : 'No'}`
            );

        } else {
            await bot.sendMessage(msg.chat.id, '❌ Please send an image.');
        }
    } catch (error) {
        console.error('Error processing message:', error);

        let errorMessage = '❌ An error occurred while processing your image.';
        if (error.response) {
            errorMessage += `\nError: ${error.response.data.error || 'Unknown API error'}`;
        }

        await bot.sendMessage(msg.chat.id, errorMessage);
    }
});

// Error handling for bot
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

console.log('Bot is running...');