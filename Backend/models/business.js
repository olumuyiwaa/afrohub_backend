import mongoose from 'mongoose';

const BusinessSchema = new mongoose.Schema({
    businessTitle: { type: String, },
    businessDescription: { type: String, },
    businessLocation: { type: String, },
    businessAddress: { type: String, },
    businessCategory: { type: String, },
    twitter: String,
    facebook: String,
    linkedIn: String,
    instagram: String,
    webAddress: String,
    whatsapp: String,
    mediaFiles: [{ type: String }]
});

export default mongoose.model('Business', BusinessSchema);