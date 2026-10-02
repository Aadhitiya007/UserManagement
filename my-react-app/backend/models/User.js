const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long']
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    age: {
        type: Number,
        required: [true, 'Age is required'],
        min: [19, 'Age must be greater than 18']
    },
    number: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [/^\d{10}$/, 'Number must contain exactly 10 digits']
    },
    country: {
        type: String,
        required: [true, 'Country is required']
    },
    avatar: {
        type: String,
        default: ""
    }
}, { timestamps: true });

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    if (!this.password.startsWith('$2a$') && !this.password.startsWith('$2b$')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
});

const user = mongoose.model('user', userSchema);
module.exports = user;
