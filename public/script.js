const chatBox = document.getElementById("chatBox");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const quickPrompts = document.getElementById("quickPrompts");

let messageHistory = [];

function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatBotResponse(text) {
    let escaped = escapeHTML(text);

    // Format blok kode ```bahasa ... ```
    escaped = escaped.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

    // Format inline code `...`
    escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Format teks tebal **...**
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // Pertahankan baris baru di luar blok <pre>
    const parts = escaped.split(/(<pre><code>[\s\S]*?<\/code><\/pre>)/g);
    return parts
        .map((part) => (part.startsWith("<pre>") ? part : part.replace(/\n/g, "<br>")))
        .join("");
}

async function sendMessage(customText = null) {
    const text = (typeof customText === "string" ? customText : userInput.value).trim();
    if (!text) return;

    if (quickPrompts) {
        quickPrompts.style.display = "none";
    }

    appendMessage("user", text);
    userInput.value = "";
    userInput.style.height = "auto";
    sendBtn.disabled = true;

    messageHistory.push({ role: "user", content: text });
    const botBubble = appendMessage("bot", "");

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: messageHistory })
        });

        if (!response.ok) {
            throw new Error("Terjadi kesalahan pada server");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let botFullResponse = "";
        let sseBuffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split("\n");
            sseBuffer = lines.pop(); // Simpan sisa potongan baris yang belum lengkap

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith("data:")) {
                    const data = trimmedLine.slice(5).trim();
                    if (data === "[DONE]") break;

                    try {
                        const parsedData = JSON.parse(data);
                        botFullResponse += parsedData;
                        botBubble.classList.add("streaming");
                        botBubble.innerHTML = formatBotResponse(botFullResponse);
                        chatBox.scrollTop = chatBox.scrollHeight;
                    } catch (e) {
                        console.error("Error parsing chunk:", e);
                    }
                }
            }
        }

        botBubble.classList.remove("streaming");
        botBubble.innerHTML = formatBotResponse(botFullResponse);
        messageHistory.push({ role: "assistant", content: botFullResponse });

    } catch (error) {
        botBubble.classList.remove("streaming");
        botBubble.textContent = "Maaf, server sedang sibuk atau terjadi kesalahan.";
        console.error(error);
    } finally {
        sendBtn.disabled = false;
        userInput.focus();
    }
}

function appendMessage(sender, text) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", sender);

    const avatarDiv = document.createElement("div");
    avatarDiv.classList.add("avatar");
    avatarDiv.textContent = sender === "bot" ? "AI" : "Anda";

    const bubbleDiv = document.createElement("div");
    bubbleDiv.classList.add("bubble");
    if (text) {
        bubbleDiv.innerHTML = sender === "bot"
            ? formatBotResponse(text)
            : escapeHTML(text).replace(/\n/g, "<br>");
    }

    msgDiv.appendChild(avatarDiv);
    msgDiv.appendChild(bubbleDiv);
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    return bubbleDiv;
}

sendBtn.addEventListener("click", () => sendMessage());

userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = `${Math.min(userInput.scrollHeight, 130)}px`;
});

document.querySelectorAll(".prompt-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
        sendMessage(chip.getAttribute("data-text"));
    });
});

clearBtn.addEventListener("click", () => {
    messageHistory = [];
    chatBox.innerHTML = `
        <div class="message bot">
            <div class="avatar">AI</div>
            <div class="bubble">Percakapan telah direset. Ada yang bisa saya bantu?</div>
        </div>
    `;
});