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
app.use(express.json({ limit: '10mb' }));

// Route chào mừng
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Cloudinary API Server!' });
});

// Lấy tất cả file trong thư mục
app.get('/files/all', async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression(`prefix:${FOLDER}/`)
      .sort_by('created_at', 'desc')
      .execute();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lấy theo ID
app.get('/files/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await cloudinary.api.resource(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload file (hỗ trợ cả image và raw như JSON)
app.post('/upload', async (req, res) => {
  const { file, folder } = req.body;
  if (!file) return res.status(400).json({ error: 'Thiếu file để upload.' });

  try {
    const result = await cloudinary.uploader.upload(file, {
      folder: folder || FOLDER,
      resource_type: 'auto', // tự động nhận diện loại file
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cập nhật file (đổi tên hoặc mô tả)
app.put('/files', async (req, res) => {
  const { id, newPublicId, description } = req.body;
  if (!id) return res.status(400).json({ error: 'Thiếu ID tài nguyên.' });

  try {
    if (newPublicId) await cloudinary.uploader.rename(id, newPublicId);
    if (description !== undefined) {
      await cloudinary.uploader.add_context(`caption=${description}`, id);
    }
    res.json({ message: 'Cập nhật thành công' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Xóa theo ID
app.delete('/files/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await cloudinary.uploader.destroy(id);
    res.json({ message: 'Xóa thành công', result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug: Lấy config
app.get('/config', (req, res) => {
  res.json({
    cloud_name: cloudinary.config().cloud_name,
    api_key: cloudinary.config().api_key,
    has_secret: !!cloudinary.config().api_secret,
  });
});

// Debug: Lấy tất cả public_id (tối đa 10)
app.get('/files/public', async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression('*')
      .sort_by('created_at', 'desc')
      .max_results(100)
      .execute();
    res.json(result.resources.slice(0, 10).map(r => ({
      public_id: r.public_id,
      folder: r.folder,
      created_at: r.created_at
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
