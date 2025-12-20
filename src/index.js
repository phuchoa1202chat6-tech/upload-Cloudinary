import express from 'express';
import { v2 as cloudinary } from 'cloudinary';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const FOLDER = process.env.CLOUDINARY_FOLDER || 'AI Slide';

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  console.error('Missing Cloudinary configuration. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env');
  process.exit(1);
}

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // tăng limit nếu upload base64 lớn

// Lấy danh sách file (theo folder) hoặc chi tiết theo id (public_id)
app.get('/files', async (req, res) => {
  const { id } = req.query;
  try {
    if (id) {
      const result = await cloudinary.api.resource(id);
      return res.json(result);
    }
    const result = await cloudinary.search
      .expression(`folder:${FOLDER}`)
      .sort_by('created_at', 'desc')
      .execute();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload: gửi { file: "<data_url||remote_url||path>", folder: "optional" }
app.post('/upload', async (req, res) => {
  const { file, folder } = req.body;
  if (!file) return res.status(400).json({ error: 'Thiếu file để upload.' });
  try {
    const result = await cloudinary.uploader.upload(file, { folder: folder || FOLDER });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cập nhật: { id, newPublicId, description }
app.put('/files', async (req, res) => {
  const { id, newPublicId, description } = req.body;
  if (!id) return res.status(400).json({ error: 'Thiếu ID tài nguyên.' });
  try {
    if (newPublicId) await cloudinary.uploader.rename(id, newPublicId);
    if (description !== undefined) {
      // Lưu mô tả vào context (key=caption)
      await cloudinary.uploader.add_context(`caption=${description}`, id);
    }
    res.json({ message: 'Cập nhật thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xóa theo public_id
app.delete('/files/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await cloudinary.uploader.destroy(id);
    res.json({ message: 'Xóa thành công', result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
