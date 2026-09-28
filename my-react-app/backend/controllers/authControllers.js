const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // 1. Fetch User / Admin directly from MongoDB by email
        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // 2. Validate password stored directly in MongoDB using bcrypt
        let isMatch = false;
        if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$")) {
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            isMatch = user.password === password;
        }

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const JWT_SECRET = process.env.JWT_SECRET;

        // 3. Generate JWT containing real MongoDB _id, email, and role
        const payload = {
            id: user._id,
            email: user.email,
            role: user.role,
            name: user.name
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

        console.log(`🔐 [DB LOGIN SUCCESS] User: "${user.email}" | Role: "${user.role}" | ID: ${user._id}`);

        return res.status(200).json({
            message: "Login Successful",
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        console.error("❌ [LOGIN ERROR]:", error.message);
        return res.status(500).json({ message: error.message || "Internal server error" });
    }
};

const userRegister = async (req, res) => {
    try {
        const { name, email, password, age, number, country } = req.body;

        if (!name || !email || !password || !age || !number || !country) {
            return res.status(400).json({ message: "All fields are required" });
        }

        
        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return res.status(400).json({ message: "User with this email already exists" });
        }

        
        const hashedPassword = await bcrypt.hash(password, 10);

        
        const newUser = await User.create({
            name,
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            role: "user",
            age: Number(age),
            number,
            country
        });

        const JWT_SECRET = process.env.JWT_SECRET;

        
        const payload = {
            id: newUser._id,
            email: newUser.email,
            role: newUser.role,
            name: newUser.name
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

        console.log(`✨ [USER SIGNUP SUCCESS] New User Registered: "${newUser.email}" (ID: ${newUser._id})`);

        return res.status(201).json({
            message: "User registered successfully",
            token,
            user: {
                id: newUser._id,
                email: newUser.email,
                name: newUser.name,
                role: newUser.role
            }
        });
    } catch (error) {
        console.error("❌ [SIGNUP ERROR]:", error.message);
        const statusCode = error.name === 'ValidationError' ? 400 : 500;
        return res.status(statusCode).json({ message: error.message || "Failed to register user" });
    }
};

const userLogout = async (req, res) => {
    try {
        const userEmail = req.user ? req.user.email : "Authenticated User";
        console.log(`🚪 [BACKEND LOGOUT SUCCESS] User "${userEmail}" logged out.`);
        return res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        console.error("❌ [LOGOUT ERROR]:", error.message);
        return res.status(500).json({ message: "Logout failed" });
    }
};

module.exports = { adminLogin, userRegister, userLogout };