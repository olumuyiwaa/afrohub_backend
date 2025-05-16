import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";
import genToken from "../utils/tokenGen.js";
import cloudinary from '../config/cloudinary.js';

/**
 * Upload file to cloudinary
 * @param {Buffer} fileBuffer - File buffer
 * @param {String} folder - Destination folder
 * @returns {Promise<Object>} - Cloudinary upload result
 */
const uploadToCloudinary = async (fileBuffer, folder) => {
  try {
    return await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${fileBuffer.toString('base64')}`,
      { folder }
    );
  } catch (error) {
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

/**
 * Register a new user
 * @route POST /api/users/register
 * @access Public
 */
const registerUser = asyncHandler(async (req, res) => {
  const {
    full_name,
    role,
    email,
    password,
    confirm_password,
    phone_number = "+234",
    entityDescription = "",
    countryLocated = "",
    countryRepresented = "",
  } = req.body;

  // Validate required fields
  if (!full_name || !email || !password || !confirm_password || !role) {
    res.status(400);
    throw new Error("Please provide all required fields.");
  }

  // Validate password match
  if (password !== confirm_password) {
    res.status(400);
    throw new Error("Passwords do not match.");
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    res.status(400);
    throw new Error("User with this email already exists.");
  }

  // Handle media files upload (limited to 6)
  let mediaFiles = [];
  if (req.files?.gallery?.length > 0) {
    const galleryFiles = req.files.gallery.slice(0, 6);
    
    try {
      for (const file of galleryFiles) {
        const galleryUpload = await uploadToCloudinary(file.buffer, 'users/gallery');
        mediaFiles.push(galleryUpload.secure_url);
      }
    } catch (error) {
      res.status(400);
      throw new Error(`Gallery upload failed: ${error.message}`);
    }
  }

  // Create new user
  const user = await User.create({
    full_name,
    email,
    password, // Note: Password should be hashed in the User model pre-save hook
    phone_number,
    role,
    entityDescription,
    countryLocated,
    countryRepresented,
    mediaFiles
  });

  if (user) {
    // Generate JWT token
    const token = genToken(user._id);
    
    // Set cookie with token
    res.cookie("token", token, {
      path: "/",
      httpOnly: true,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours
      sameSite: "none",
      secure: true,
    });

    // Return user data and token
    res.status(201).json({
      id: user._id,
      full_name: user.full_name,
      email: user.email,
      phone_number: user.phone_number,
      entityDescription: user.entityDescription,
      countryLocated: user.countryLocated,
      countryRepresented: user.countryRepresented,
      mediaFiles: user.mediaFiles,
      createdAt: user.createdAt,
      token,
      role
    });
  } else {
    res.status(400);
    throw new Error("Failed to register user.");
  }
});

/**
 * Update user profile
 * @route PATCH /api/users/profile/:id
 * @access Private
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    full_name,
    email,
    phone_number,
    interests,
    role,
    entityDescription,
    countryLocated,
    countryRepresented,
  } = req.body;
  
  // Find the user by ID
  const user = await User.findById(id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  
  // Update basic fields if provided
  if (full_name) user.full_name = full_name;
  if (email) {
    // Check if email is being changed and new email is already in use
    if (email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(400);
        throw new Error("Email already in use");
      }
    }
    user.email = email;
  }
  if (phone_number) user.phone_number = phone_number;
  if (interests) user.interests = interests;
  
  // Handle role update (validate allowed roles)
  const validRoles = ['admin', 'user', 'ambassador', 'artist', 'sub_admin'];
  if (role && validRoles.includes(role)) {
    user.role = role;
  } else if (role) {
    res.status(400);
    throw new Error(`Invalid role. Allowed values: ${validRoles.join(', ')}`);
  }
  
  // Update additional fields
  if (entityDescription !== undefined) user.entityDescription = entityDescription;
  if (countryLocated !== undefined) user.countryLocated = countryLocated;
  if (countryRepresented !== undefined) user.countryRepresented = countryRepresented;
  
  // Handle media files if provided as URLs in request body
  if (req.body.mediaFiles && Array.isArray(req.body.mediaFiles)) {
    user.mediaFiles = req.body.mediaFiles;
  }
  
  // Handle profile image upload
  if (req.files?.image?.[0]) {
    try {
      const imageUpload = await uploadToCloudinary(
        req.files.image[0].buffer,
        'users/profile'
      );
      user.image = imageUpload.secure_url;
    } catch (error) {
      res.status(400);
      throw new Error(`Profile image upload failed: ${error.message}`);
    }
  }
  
  // Handle gallery uploads (limited to 6)
  if (req.files?.gallery?.length > 0) {
    try {
      let mediaFiles = [];
      const galleryFiles = req.files.gallery.slice(0, 6);
      
      for (const file of galleryFiles) {
        const galleryUpload = await uploadToCloudinary(
          file.buffer,
          'users/gallery'
        );
        mediaFiles.push(galleryUpload.secure_url);
      }
      
      user.mediaFiles = mediaFiles;
    } catch (error) {
      res.status(400);
      throw new Error(`Gallery upload failed: ${error.message}`);
    }
  }
  
  // Save the updated user
  await user.save();
  
  // Return updated user data
  res.status(200).json({
    message: "Profile updated successfully",
    user: {
      id: user._id,
      full_name: user.full_name,
      email: user.email,
      phone_number: user.phone_number,
      interests: user.interests,
      role: user.role,
      entityDescription: user.entityDescription,
      countryLocated: user.countryLocated,
      countryRepresented: user.countryRepresented,
      mediaFiles: user.mediaFiles,
      image: user.image,
    },
  });
});

/**
 * Delete user account
 * @route DELETE /api/users
 * @access Private
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const { email, userId } = req.query;

  // Validate input parameters
  if (!email && !userId) {
    res.status(400);
    throw new Error("Email or user ID is required");
  }

  // Create query based on provided parameters
  const query = email ? { email } : { _id: userId };

  // Find and delete the user
  const deletedUser = await User.findOneAndDelete(query);

  // Check if user was found
  if (!deletedUser) {
    res.status(404);
    throw new Error("User not found");
  }

  // Return success response
  res.status(200).json({ message: "User account deleted successfully" });
});

/**
 * Get user profile by ID
 * @route GET /api/users/profile/:id
 * @access Public
 */
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('full_name phone_number interests image mediaFiles role');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  res.status(200).json(user);
});

// Export all controller functions
const userController = {
  registerUser,
  updateProfile,
  deleteAccount,
  getProfile
};

export default userController;