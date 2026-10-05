const User = require("../models/User");

// Get all users (supports backend search query: /api/users?search=term)
exports.getUsers = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query = {
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { role: searchRegex },
          { country: searchRegex },
          { phone: searchRegex }
        ]
      };
    }

    const users = await User.find(query).select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete user (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Update user details (Admin only)
exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, age, country, phone } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (age !== undefined) user.age = age;
    if (country) user.country = country;
    if (phone) user.phone = phone;

    await user.save();
    res.json({ message: "User updated successfully", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};