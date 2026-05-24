const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto"); // --- MODIFIKASI ---

const socket = io("http://localhost:3000");

// --- MODIFIKASI ---
// Hasilkan pasangan kunci RSA untuk klien ini
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048, // Standar keamanan yang baik
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
// --- AKHIR MODIFIKASI ---

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
});

let registeredUsername = "";
let username = "";
const users = new Map(); // Ini akan menyimpan { username: publicKey }

socket.on("connect", () => {
    console.log("Connected to the server");

    rl.question("Enter your username: ", (input) => {
        username = input;
        registeredUsername = input;
        console.log(`Welcome, ${username} to the chat`);

        // --- MODIFIKASI ---
        // Kirim public key yang sebenarnya
        socket.emit("registerPublicKey", {
            username,
            publicKey: publicKey, // Kirim kunci yang dihasilkan
        });
        // --- AKHIR MODIFIKASI ---

        rl.prompt();

        rl.on("line", (message) => {
            if (message.trim()) {
                if ((match = message.match(/^!impersonate (\w+)$/))) {
                    username = match[1];
                    console.log(`Now impersonating as ${username}`);
                } else if (message.match(/^!exit$/)) {
                    username = registeredUsername;
                    console.log(`Now you are ${username}`);
                } else {
                    // --- MODIFIKASI ---
                    // Buat tanda tangan sebelum mengirim
                    const sign = crypto.createSign("SHA256");
                    sign.update(message);
                    sign.end();
                    const signature = sign.sign(privateKey, "hex"); // Tanda tangani dengan private key kita

                    // Kirim pesan DAN tanda tangan
                    socket.emit("message", { username, message, signature });
                    // --- AKHIR MODIFIKASI ---
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
    users.set(username, publicKey); // Simpan public key pengguna baru
    console.log(`${username} join the chat`);
    rl.prompt();
});

// --- MODIFIKASI ---
// Ini adalah inti dari logika deteksi
socket.on("message", (data) => {
    const { username: senderUsername, message: senderMessage, signature } = data;

    // Jangan verifikasi pesan kita sendiri
    if (senderUsername !== registeredUsername) {
        const senderPublicKey = users.get(senderUsername);

        if (senderPublicKey) {
            // Verifikasi tanda tangan menggunakan public key pengirim
            const verify = crypto.createVerify("SHA256");
            verify.update(senderMessage);
            verify.end();

            const isVerified = verify.verify(senderPublicKey, signature, "hex");

            // Terapkan logika berdasarkan hasil verifikasi
            if (isVerified) {
                // JIKA BENAR: Pesan ini sah. Tampilkan seperti biasa.
                console.log(`${senderUsername}: ${senderMessage}`);
            } else {
                // JIKA SALAH: Ini adalah upaya peniruan!
                console.log(
                    `${senderUsername} (⚠️ THIS USER IS FAKE): ${senderMessage}`
                );
            }
        } else {
            // Tidak dapat menemukan public key untuk pengguna (seharusnya tidak terjadi)
            console.log(`Received message from unknown user ${senderUsername}`);
        }
        rl.prompt();
    }
});
// --- AKHIR MODIFIKASI ---

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