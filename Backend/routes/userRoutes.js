import express from 'express';
import userController from '../controller/userController.js';
import { loginUser, logOut } from '../controller/login.js';
import { updatePassword, forgotPassword, resetPassword } from '../controller/passwordController.js';
// import bookMarkController from '../controller/eventBookmark.js';
import upload from "../middleware/multer.js";
import Secure from '../middleware/auth.js';

const router = express.Router();

// User Registration and Authentication
router.post('/register', upload.fields([{ name: "gallery", maxCount: 6 }]), userController.registerUser);
router.post("/login", loginUser);
router.get("/logout", logOut);

// Password Management
router.patch('/updatepassword', Secure, updatePassword);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resetToken', resetPassword);

// Profile Management
router.get("/profile/:id", userController.getProfile);
router.patch("/profile/:id", upload.fields([
  { name: "image", maxCount: 1 },
  { name: "gallery", maxCount: 6 }
]), userController.updateProfile);

// Account Deletion
router.delete("/delete-account", userController.deleteAccount);

export default router;