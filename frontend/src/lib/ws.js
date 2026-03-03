const WS_URL = import.meta.env.VITE_WS_URL;

let socket = null;
let isOpen = false;
let reconnectTimer = null;

const listeners = new Set(); // functions(msg)

function notify(msg) {
    for (const fn of listeners) fn(msg);
}

function connect() {
    // already connected/connecting
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    socket = new WebSocket(WS_URL);

    socket.addEventListener("open", () => {
        isOpen = true;
    });

    socket.addEventListener("message", (ev) => {
        try {
            const msg = JSON.parse(ev.data);
            notify(msg);
        } catch {
            notify({ type: "error", message: "Invalid JSON from server" });
        }
    });

    socket.addEventListener("close", () => {
        isOpen = false;

        // simple reconnect
        if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                connect();
            }, 800);
        }
    });

    socket.addEventListener("error", () => {
        try { socket.close(); } catch { }
    });
}

function send(payload) {
    if (!socket || !isOpen) return false;
    socket.send(JSON.stringify(payload));
    return true;
}

export function onWSMessage(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function ensureWSConnected() {
    connect();
}

export function wsSubscribe(matchId) {
    return send({ type: "subscribe", matchId: Number(matchId) });
}

export function wsUnsubscribe(matchId) {
    return send({ type: "unsubscribe", matchId: Number(matchId) });
}

export function wsSend(payload) {
    return send(payload);
}