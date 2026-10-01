const User = require('../models/User');
const fs = require('fs');
const pdfParse = require('pdf-parse');

const csvParser = require('csv-parser');

function parseCsvContent(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('data', (data) => {
                const normalized = {};
                Object.keys(data).forEach((key) => {
                    normalized[key.trim().toLowerCase()] = data[key]?.trim() || "";
                });
                results.push(normalized);
            })
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
    });
}

function parsePdfContent(text) {
    const users = [];
    if (!text || !text.trim()) return users;
    const trimmed = text.trim();
    
    
    const jsonMatch = trimmed.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {
            
        }
    }

    
    const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 0 && lines[0].toLowerCase().includes('name') && lines[0].toLowerCase().includes('email')) {
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length >= 2) {
                const userObj = {};
                headers.forEach((header, idx) => {
                    userObj[header] = values[idx] || "";
                });
                if (userObj.name && userObj.email) {
                    users.push(userObj);
                }
            }
        }
        if (users.length > 0) return users;
    }

    
    let currentUser = {};
    for (const line of lines) {
        const nameMatch = line.match(/(?:Name|Full\s*Name)\s*:\s*(.+)/i);
        const emailMatch = line.match(/Email\s*:\s*(.+)/i);
        const numberMatch = line.match(/(?:Number|Phone|Mobile)\s*:\s*(.+)/i);
        const ageMatch = line.match(/Age\s*:\s*(\d+)/i);
        const countryMatch = line.match(/Country\s*:\s*(.+)/i);

        if (nameMatch) {
            if (currentUser.name && currentUser.email) {
                users.push(currentUser);
                currentUser = {};
            }
            currentUser.name = nameMatch[1].trim();
        }
        if (emailMatch) currentUser.email = emailMatch[1].trim();
        if (numberMatch) currentUser.number = numberMatch[1].trim();
        if (ageMatch) currentUser.age = Number(ageMatch[1].trim());
        if (countryMatch) currentUser.country = countryMatch[1].trim();
    }
    if (currentUser.name && currentUser.email) {
        users.push(currentUser);
    }

    return users;
}

const createUser = async (req, res) => {
    try {
        const { name, email, password, role, number, age, country } = req.body;
        const avatarPath = req.file ? `/uploads/${req.file.filename}` : "";
        console.log(`➕ [CREATE USER] Name: "${name}", Email: "${email}"${avatarPath ? `, Avatar: "${avatarPath}"` : ""}`);
        const user = await User.create({
            name,
            email,
            password: password || "user123",
            role: role || "user",
            number,
            age: age ? Number(age) : undefined,
            country,
            avatar: avatarPath
        });
        console.log(`✅ [CREATED] User ID: ${user._id}`);
        res.status(201).json(user);
    } catch (error) {
        console.error(`❌ [CREATE ERROR]:`, error.message);
        const statusCode = error.name === 'ValidationError' ? 400 : 500;
        let errors = {};
        if (error.name === 'ValidationError') {
            Object.keys(error.errors).forEach(key => {
                errors[key] = error.errors[key].message;
            });
        }
        res.status(statusCode).json({
            message: error.message,
            errors
        });
    }
};

const uploadUsersFromFile = async (req, res) => {
    let filePath = null;
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Please upload a JSON, CSV, or PDF file" });
        }

        filePath = req.file.path;
        const originalName = req.file.originalname.toLowerCase();
        const mimetype = req.file.mimetype.toLowerCase();
        console.log(`📁 [BULK IMPORT] File received: "${req.file.originalname}" (Size: ${req.file.size} bytes, Type: ${req.file.mimetype})`);

        let rawRecords = [];

        if (originalName.endsWith('.json') || mimetype.includes('json')) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            let parsed;
            try {
                parsed = JSON.parse(fileContent);
            } catch (e) {
                return res.status(400).json({ message: "Invalid JSON file format" });
            }
            rawRecords = Array.isArray(parsed) ? parsed : [parsed];
        } else if (originalName.endsWith('.csv') || mimetype.includes('csv') || mimetype.includes('spreadsheet')) {
            try {
                rawRecords = await parseCsvContent(filePath);
            } catch (e) {
                return res.status(400).json({ message: "Invalid CSV file format" });
            }
        } else if (originalName.endsWith('.pdf') || mimetype.includes('pdf')) {
            const dataBuffer = fs.readFileSync(filePath);
            let pdfData;
            try {
                pdfData = await pdfParse(dataBuffer);
            } catch (e) {
                return res.status(400).json({ message: "Invalid or corrupted PDF file" });
            }

            if (!pdfData.text || !pdfData.text.trim()) {
                return res.status(400).json({ message: "Empty PDF file or scanned PDF without selectable text" });
            }
            rawRecords = parsePdfContent(pdfData.text);
        } else {
            return res.status(400).json({ message: "Unsupported file type. Please upload a JSON, CSV, or PDF file." });
        }

        
        const usersToInsert = rawRecords.filter(user => {
            return user && typeof user === 'object' &&
                   user.name && String(user.name).trim() !== '' &&
                   user.email && String(user.email).trim() !== '';
        });

        if (usersToInsert.length === 0) {
            console.log(`⚠️ [BULK IMPORT WARNING] No valid user records parsed from "${req.file.originalname}"`);
            return res.status(400).json({ message: "No valid user records found" });
        }

        const createdUsers = await User.insertMany(usersToInsert);
        console.log(`✅ [BULK IMPORT SUCCESS] Inserted ${createdUsers.length} users into MongoDB`);

        return res.status(201).json({
            message: `Successfully imported ${createdUsers.length} users`,
            count: createdUsers.length
        });
    } catch (error) {
        console.error(`❌ [BULK IMPORT ERROR]:`, error.message);
        return res.status(500).json({
            message: error.message || "Failed to process user data file"
        });
    } finally {
      
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (err) {
                console.error("Failed to delete temp file:", err.message);
            }
        }
    }
};

const getUsers = async (req, res) => {
    try {
        const search = req.query.search?.trim();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const escapedSearch = search?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const isNumeric = search && !isNaN(search) && !isNaN(parseFloat(search));
        const stringFields = ['name', 'email', 'number', 'country'];
        
        const orConditions = search
            ? stringFields.map((field) => ({
                [field]: { $regex: escapedSearch, $options: 'i' }
            }))
            : [];

        if (search && isNumeric) {
            orConditions.push({ age: Number(search) });
        }

        const filter = search ? { $or: orConditions } : {};

        const totalUsers = await User.countDocuments(filter);
        const users = await User.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        const totalPages = Math.ceil(totalUsers / limit) || 1;

        console.log(`🔍 [GET USERS] Page ${page}/${totalPages}, Limit: ${limit}, Search: "${search || 'ALL'}" -> Found ${users.length} users (Total: ${totalUsers})`);
        
        res.status(200).json({
            users,
            totalUsers,
            totalPages,
            currentPage: page,
            limit
        });
    } catch (error) {
        console.error(`❌ [GET USERS ERROR]:`, error.message);
        res.status(500).json({
            message: error.message
        });
    }
};

const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            console.log(`⚠️ [GET USER] User ID: ${req.params.id} not found`);
            return res.status(404).json({
                message: 'User not found'
            });
        }
        console.log(`👤 [GET USER] Fetched details for: "${user.name}" (${user._id})`);
        res.status(200).json(user);
    } catch (error) {
        console.error(`❌ [GET USER ERROR]:`, error.message);
        res.status(500).json({
            message: error.message
        });
    }
};

const updateUser = async (req, res) => {
    try {
        const updateData = { ...req.body };
        if (updateData.age) updateData.age = Number(updateData.age);
        if (req.file) {
            updateData.avatar = `/uploads/${req.file.filename}`;
        }
        console.log(`✏️ [UPDATE USER] User ID: ${req.params.id}`, updateData);
        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { returnDocument: "after", runValidators: true }
        );
        if (!user) {
            console.log(`⚠️ [UPDATE USER] User ID: ${req.params.id} not found`);
            return res.status(404).json({
                message: 'User not found'
            });
        }
        console.log(`✅ [UPDATE SUCCESS] User "${user.name}" updated successfully`);
        res.status(200).json(user);
    } catch (error) {
        console.error(`❌ [UPDATE ERROR]:`, error.message);
        const statusCode = error.name === 'ValidationError' ? 400 : 500;
        let errors = {};
        if (error.name === 'ValidationError') {
            Object.keys(error.errors).forEach(key => {
                errors[key] = error.errors[key].message;
            });
        }
        res.status(statusCode).json({
            message: error.message,
            errors
        });
    }
};

const deleteUser = async (req, res) => {
    try {
        console.log(`🗑️ [DELETE USER] Attempting to delete User ID: ${req.params.id}`);
        const user = await User.findByIdAndDelete(req.params.id);
        
        if (!user) {
            console.log(`⚠️ [DELETE USER] User ID: ${req.params.id} not found`);
            return res.status(404).json({
                message: 'User not found'
            });
        }
        console.log(`✅ [DELETE SUCCESS] User "${user.name}" deleted from database`);
        res.status(200).json({
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error(`❌ [DELETE ERROR]:`, error.message);
        res.status(500).json({
            message: error.message
        });
    }
};

const deleteAllUsers = async (req, res) => {
    try {
        console.log(`🗑️ [DELETE ALL USERS] Clearing all users from database`);
        const result = await User.deleteMany({});
        console.log(`✅ [DELETE ALL SUCCESS] Deleted ${result.deletedCount} users from database`);
        res.status(200).json({
            message: `Successfully deleted all ${result.deletedCount} users`,
            count: result.deletedCount
        });
    } catch (error) {
        console.error(`❌ [DELETE ALL ERROR]:`, error.message);
        res.status(500).json({
            message: error.message
        });
    }
};

const exportUsers = async (req, res) => {
    try {
        console.log(`📤 [EXPORT USERS] Exporting database users to CSV`);
        const users = await User.find({}).sort({ createdAt: -1 });

        const headers = ["Name", "Email", "Age", "Number", "Country"];
        const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

        const csvRows = [
            headers.join(','),
            ...users.map(u => [
                escapeCsv(u.name),
                escapeCsv(u.email),
                escapeCsv(u.age),
                escapeCsv(u.number),
                escapeCsv(u.country)
            ].join(','))
        ];

        const csvContent = csvRows.join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
        return res.status(200).send(csvContent);

    } catch (error) {
        console.error(`❌ [EXPORT ERROR]:`, error.message);
        res.status(500).json({
            message: error.message || 'Failed to export users'
        });
    }
};

const downloadTemplate = async (req, res) => {
    try {
        console.log(`📋 [DOWNLOAD TEMPLATE] Serving CSV template`);
        const templateContent = [
            "Name,Email,Password,Age,Number,Country",
            '"John Doe","john@example.com","Pass123!",25,"9876543210","USA"',
            '"Jane Smith","jane@example.com","Pass456!",30,"9123456789","India"'
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="users_template.csv"');
        return res.status(200).send(templateContent);
    } catch (error) {
        console.error(`❌ [TEMPLATE ERROR]:`, error.message);
        res.status(500).json({
            message: error.message || 'Failed to download template'
        });
    }
};

module.exports = {
  createUser,
  uploadUsersFromFile,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  deleteAllUsers,
  exportUsers,
  downloadTemplate
};