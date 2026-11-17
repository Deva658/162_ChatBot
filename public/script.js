const chatBox = document.getElementById("chatBox");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

let messageHistory = []; 

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    appendMessage("user", text);
    userInput.value = "";
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

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith("data:")) {
                    const data = trimmedLine.slice(5).trim();
                    if (data === "[DONE]") break;

                    try {
                        const parsedData = JSON.parse(data);
                        botFullResponse += parsedData;
                        botBubble.textContent = botFullResponse;
                        chatBox.scrollTop = chatBox.scrollHeight;
                    } catch (e) {
                        console.error("Error parsing chunk:", e);
                    }
                }
            }
        }
        messageHistory.push({ role: "assistant", content: botFullResponse });

    } catch (error) {
        botBubble.textContent = "Maaf, server sedang sibuk atau terjadi kesalahan.";
        console.error(error);
    }
}

function appendMessage(sender, text) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", sender);
    
    const bubbleDiv = document.createElement("div");
    bubbleDiv.classList.add("bubble");
    bubbleDiv.textContent = text;
    
    msgDiv.appendChild(bubbleDiv);
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    return bubbleDiv;
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});