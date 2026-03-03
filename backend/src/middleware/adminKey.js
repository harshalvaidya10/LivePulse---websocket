export function requireAdminKey(req, res, next) {
    const expected = process.env.ADMIN_KEY;
    const provided = req.header("X-ADMIN-KEY");

    if (!expected) {
        console.error("ADMIN_KEY is missing in environment variables.");
        return res.status(500).json({ error: "Server misconfigured." });
    }

    if (!provided || provided !== expected) {
        return res.status(403).json({ error: "Forbidden: invalid admin key." });
    }

    next();
}