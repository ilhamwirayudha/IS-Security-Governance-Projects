const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto"); // 1. Impor modul crypto

// 2. Buat pasangan kunci RSA untuk klien ini
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
        type: "spki",
        format: "pem",
    },
    privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
    },
});

const socket = io("http://localhost:3000");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
});

let targetUsername = "";
let username = "";
const users = new Map(); // Ini akan menyimpan {username: publicKey}

socket.on("connect", () => {
    console.log("Connected to the server");

    rl.question("Enter your username: ", (input) => {
        username = input;
        console.log(`Welcome, ${username} to the chat`);

        // 3. Daftarkan public key yang asli, bukan placeholder
        socket.emit("registerPublicKey", {
            username,
            publicKey: publicKey, // Kirim public key yang sudah di-generate
        });
        rl.prompt();

        rl.on("line", (message) => {
            if (message.trim()) {
                const match = message.match(/^!secret (\w+)$/);
                if (match) {
                    targetUsername = match[1];
                    if (users.has(targetUsername)) {
                        console.log(`Now secretly chatting with ${targetUsername}`);
                    } else {
                        console.log(`User ${targetUsername} not found. Cannot start secret chat.`);
                        targetUsername = ""; // Reset jika user tidak ada
                    }
                } else if (message.match(/^!exit$/)) {
                    console.log(`No more secretly chatting.`);
                    targetUsername = "";
                } else {
                    // 4. Logika pengiriman pesan yang dimodifikasi
                    if (targetUsername) {
                        // --- KIRIM PESAN TERENKRIPSI ---
                        const targetPublicKey = users.get(targetUsername);
                        if (targetPublicKey) {
                            try {
                                const encryptedMessage = crypto.publicEncrypt(
                                    {
                                        key: targetPublicKey,
                                        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                                        oaepHash: "sha256",
                                    },
                                    Buffer.from(message)
                                );

                                // Kirim payload terenkripsi
                                socket.emit("message", {
                                    username: username,
                                    message: encryptedMessage.toString("base64"), // Kirim sebagai string base64
                                    isEncrypted: true,
                                    target: targetUsername,
                                });
                            } catch (err) {
                                console.log("Encryption failed:", err.message);
                            }
                        } else {
                            console.log(`Could not find public key for ${targetUsername}. Message not sent.`);
                        }
                    } else {
                        // --- KIRIM PESAN PUBLIK (TIDAK TERENKRIPSI) ---
                        socket.emit("message", {
                            username: username,
                            message: message,
                            isEncrypted: false,
                        });
                    }
                }
            }
            rl.prompt();
        });
    });
});

socket.on("init", (keys) => {
    keys.forEach(([user, key]) => users.set(user, key));
    console.log(`\nThere are currently ${users.size} users in the chat`);
    rl.prompt();
});

socket.on("newUser", (data) => {
    const { username, publicKey } = data;
    users.set(username, publicKey);
    console.log(`\n${username} join the chat`);
    rl.prompt();
});

// 5. Logika penerimaan pesan yang dimodifikasi (paling penting)
socket.on("message", (data) => {
    const { username: senderUsername, message: content, isEncrypted, target } = data;

    // Jangan tampilkan pesan dari diri sendiri
    if (senderUsername === username) {
        return;
    }

    if (isEncrypted) {
        // Pesan ini terenkripsi
        if (target === username) {
            // DAN pesan ini untuk KITA
            try {
                const encryptedBuffer = Buffer.from(content, "base64");
                const decryptedMessage = crypto.privateDecrypt(
                    {
                        key: privateKey, // Gunakan private key KITA untuk dekripsi
                        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                        oaepHash: "sha256",
                    },
                    encryptedBuffer
                );
                // Tampilkan pesan asli
                console.log(`\n(Secret from ${senderUsername}): ${decryptedMessage.toString()}`);
            } catch (err) {
                console.log(`\nFailed to decrypt message from ${senderUsername}:`, err.message);
            }
        } else {
            // Pesan ini terenkripsi, TAPI BUKAN untuk kita
            // Tampilkan "gibberish" (ciphertext)
            console.log(`\n(Encrypted message from ${senderUsername} to ${target}): ${content.substring(0, 20)}...[gibberish]`);
        }
    } else {
        // Pesan ini tidak terenkripsi (pesan publik)
        console.log(`\n${senderUsername}: ${content}`);
    }
    rl.prompt();
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