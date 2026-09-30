const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    const token = authHeader.split(" ")[1];
    const JWT_SECRET = process.env.JWT_SECRET;

    try {
        const decodedPayload = jwt.verify(token, JWT_SECRET);
        req.user = decodedPayload; // Attach { id, email, role } to request
        next();
    } catch (err) {
        return res.status(403).json({ message: "Invalid or expired token." });
    }
};

const optionalVerifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const JWT_SECRET = process.env.JWT_SECRET;

        try {
            const decodedPayload = jwt.verify(token, JWT_SECRET);
            req.user = decodedPayload;
        } catch (err) {
            // Optional auth, proceed as guest if token invalid
        }
    }
    next();
};

module.exports = { verifyToken, optionalVerifyToken };


