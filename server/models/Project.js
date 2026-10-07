import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  color: { type: String, enum: ['purple', 'orange', 'green', 'blue'], default: 'purple' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model('Project', projectSchema);
