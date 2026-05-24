const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto"); // <-- ADDED: Import crypto module

const socket = io("http://localhost:3000");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
});

let username = "";
// <-- ADDED: A Set to store the hashes of messages we have sent
const mySentMessageHashes = new Set();

// <-- ADDED: Hash function
function hashMessage(message) {
    return crypto.createHash('sha256').update(message).digest('hex');
}

socket.on("connect", () => {
    console.log("Connected to the server");

    rl.question("Enter your username: ", (input) => {
        username = input;
        console.log(`Welcome, ${username} to the chat`);
        rl.prompt();

        rl.on("line", (message) => {
            if (message.trim()) {
                // <-- MODIFIED: Store the hash locally before sending
                const hash = hashMessage(message);
                mySentMessageHashes.add(hash);

                // Send the message *without* the hash (server wouldn't understand it anyway)
                socket.emit("message", { username, message });
            }
            rl.prompt();
        });
    });
});

// <-- MODIFIED: This entire block is updated for verification
socket.on("message", (data) => {
    const { username: senderUsername, message: senderMessage } = data;

    // Calculate the hash of the message we just received
    const receivedHash = hashMessage(senderMessage);

    if (senderUsername === username) {
        // --- THIS IS OUR OWN MESSAGE COMING BACK ---

        // Check if the received hash is one we actually sent
        if (mySentMessageHashes.has(receivedHash)) {
            // This is our original, untampered message.
            // We can safely remove its hash from the set.
            mySentMessageHashes.delete(receivedHash);
        } else {
            // *** TAMPERING DETECTED! ***
            // We received a message from "ourselves"
            // but its hash doesn't match anything we sent.
            console.log(`\n\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
            console.log(`⚠️  WARNING: Your own message was tampered with by the server!`);
            console.log(`   Server broadcasted: "${senderMessage}"`);
            console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n`);
            rl.prompt();
        }

    } else {
        // --- THIS IS A MESSAGE FROM SOMEONE ELSE ---
        // Print it normally
        console.log(`\n${senderUsername}: ${senderMessage}`);
        rl.prompt();
    }
});

socket.on("disconnect", () => {
    console.log("Server disconnected, Exiting...");
    rl.close();
    process.exit(0);
});

rl.on("SIGINT", () => {
    console.log("\nExiting...");
    socket.disconnect();
    rl.close();
    process.exit(0);
});